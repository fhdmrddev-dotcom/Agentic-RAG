---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Workflow & Skill Studio — Trust, Clarity & Triggers
status: executing
last_updated: "2026-06-22T00:00:00.000Z"
last_activity: 2026-06-22 -- Phase 120 Plan 02 (CTX-01) executed — messages.origin + asymmetric history filter
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 67
---

# Project State

> **Scope note:** **v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers STARTED 2026-06-21 (Option A — scope LOCKED + operator-approved).** Roadmap created: CORE Phases 120-124 + STRETCH Phases 125-130 (gated behind CORE). Numbering continues from v3.0's last phase (119). Scope source: `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md`; operator pressures: `.planning/research/v3.1-skills-eval/OPERATOR-INPUTS.md`. **v3.0 Document Management SHIPPED + archived 2026-06-21** (last phase 119; SEED-005 Tier A — metadata enrichment → metadata-driven views/"virtual folders" → document relationships → auto-classification → governance health; full close-out in `.planning/milestones/` + `MILESTONES.md` + `RETROSPECTIVE.md`). The v3.x PRD roadmap was re-sequenced 2026-06-15 — authoritative map: `.planning/PRDs/SEQUENCE.md`. v2.9 STRETCH 105–109 remain backlog carry-forwards. **Everything below the "Roadmap shape (v3.1...)" block is v3.0-and-earlier accumulated context, retained per the milestone-transition convention.**

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-21 — v3.1 milestone started; v3.0 Document Management COMPLETE + archived)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Current focus:** Phase 120 — collision-fix-context-isolation

## Current Position

Phase: 120 (collision-fix-context-isolation) — EXECUTING
Plan: 3 of 3
Status: Plan 02 (CTX-01) complete — migration 076 authored (NOT applied), origin tagged at every harness write site, asymmetric history filter live. Next = Plan 03 (BLOCKING operator: apply migration 076 + regenerate full-schema.sql + live-DB integration test).
Last activity: 2026-06-22 -- Phase 120 Plan 02 (CTX-01) executed; SUMMARY written

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260611-irx | Per-process log filename — fix Windows multi-worker RotatingFileHandler rollover crash (WinError 32) | 2026-06-11 | `b5e916e2` | [260611-irx-worker-log-rotation-pid](./quick/260611-irx-worker-log-rotation-pid/) |

### Recent Completed Phases

**Phase 098 — Project Binding & Server-Side KB Scope Governance — COMPLETE (2026-06-10).** 5/5 plans. VERIFICATION verified (4/4 observable truths + 14 artifacts). HUMAN-UAT complete 6/6 (SC#10 cross-provider × multi-tool × parallel-thread × long-message + `scope_violation` observability + D-13 whitelist refusal). SECURE-PHASE `threats_open: 0` — 13 planned threats closed; WR-03 (fail-open scope → observable emit + kickoff fail-closed) + IN-01 (cycle guard) fixed in code, IN-02/IN-03 accepted (`098-SECURITY.md`). **Still OPEN (run-honesty UI polish, NOT security/scope):** BUG-260609-02 (SUB-RESULTS "Sub-task" loses desc on nav), BUG-260609-04 (phase card placeholder slug "phase-0"), 1-2s empty-bubble. **Next: `/gsd:plan-phase 099` (Workflow ↔ Skill Composition).**

---

_Historical — Phase 097 spike per-plan execution detail:_

**Plan 097-01 progress (Wave 0) — COMPLETE:**

- ✓ Task 1 (commit `75be6f92`): scaffolded `scripts/spike-097/`; installed `docxtpl==0.20.2` into the backend venv (venv-only, NOT Dockerfile.sandbox/requirements — Phase 101 does the prod add); generated `templates/risk-register.docx` with `{%tr %}` variable rows. Verified: `get_undeclared_template_variables() == {project_name, report_date, rows}`; throwaway 1/3-row render grows the table + re-opens clean.
- ✓ Task 2 (commit `5b6a87f3`): `find_risk_folder.py` mirrors `get_supabase()` (service-role, every query filtered by user_id — T-097-01) + `kb.py:186` BFS subtree; wrote `out/kb-folders.json`. Resolved test-user `user_id = d8a54002-6a29-4b88-b918-cff2aa4a06d5`.
- ✓ Task 3 (commit `61025148`, human-action resolved): existing KB had NO risk-name-matching folder, so a controlled synthetic corpus was generated (`make_sample_corpus.py` → 3 "Project Meridian" risk `.docx` in `sample-corpus/`) and the operator ingested it into a fresh folder. `find_risk_folder.py` re-ran; `out/spike-config.json` pins the confirmed `folder_id = 75755ec9-5ba7-495b-ad93-7500011cf6f2` ("Project Meridian — Risks", 3 docs / 9 embedded chunks), its `subtree_folder_ids` (bound retrieval scope), `user_id`, and `template_path`. Verify printed `confirmed folder 75755ec9…`. Citation-granularity note carried to Plan 03: one table-heavy doc chunked coarsely (1 chunk).

**Plan 097-02 progress (Wave 1, unknown a) — COMPLETE:**

- ✓ Task 1 (commit `f2cc7b3a`): `field_map.py` — cited `RiskRegisterFieldMap`/`RiskRow`/`Cited` Pydantic models (every leaf nullable + `source_chunk_id` provenance), spotlighted forced-tool prompt (`<doc id=... file=...>` — T-097-04), native Anthropic call wrapper that **mirrors but never imports** the production service (red line / G-5). A1 OpenAI-strict pivot documented, not used.
- ✓ Task 2 (commit `fc791f5f`): `derive_fields.py` — parse template (coverage oracle) → retrieve under **bound** `folder_ids` from `spike-config.json` (not a prompt hint — Pattern 2 / PROJ-02 / T-097-06) → single forced Anthropic emission → deterministic coverage+citation check → re-prompt-once. Evidence: `out/field-map.json` (6 KB-grounded rows M-01/02/03 + SR-01/02/03; 50/50 filled values cited = **100% citation coverage**; **11% null-rate** = declines not inventions; 0 invented citations; model did NOT fabricate the 4 unseen workshop-table risks) + `out/unknown-a.md` (verdict **YES**).
- **Deviation [Rule 1]:** first run truncated the tool JSON at 4096 output tokens (`stop_reason=max_tokens` → 0 rows via `default_factory=list`); raised `emit_field_map` max_tokens → 16384 + added a hard truncation guard. Re-run finished clean (`stop_reason=tool_use`, 4063 tokens).
- **Carry-forward to Plan 03/101:** retrieval's enriched chunk dict exposes no raw `document_chunks.id`, so the harness assigns `chunk-N` spotlight ids as the citation source of truth — the production citations design must thread a stable chunk id end-to-end. `Cited` provenance confirmed to belong in run OUTPUT (shape-only in `inputs`).

**Plan 097-04 progress (Wave 1, unknowns c+d) — COMPLETE:**

- ✓ Task 1 (commit `528e1d53`): `authoring_feel.py` — grounded one-shot WorkflowDefinition generation + refine loop. Assembled design-time grounding (folder tree + tool-registry names + skill names + template placeholders), one forced-tool Anthropic emission over the strict `WorkflowDefinition` schema (`extra="forbid"` + `model_validate()`), one refine turn, transcript capture. Mirrors-not-imports the production service (red line / G-5). Evidence: `out/transcript.md` (describe → refine → 2 schema-valid drafts) + `out/unknown-c.md`.
- ✓ Task 2 (human-verify checkpoint resolved, committed with plan-close): operator recorded the feel verdict in `out/unknown-d.md`. Verify passed: `unknown-d verdict OK` (>200 bytes + rating present; 8888 bytes).
- **Unknown (c) answer:** the draft USED folder tree + tool names + template placeholders (MUST-HAVE grounding for the Phase 103 generator prompt); skill registry provided but UNUSED this run (nice-to-have). `folder_scope` had no schema home → scope leaked as a resolved folder id inside an llm_agent prompt string → **PROJ-02**: add additive bound `folder_scope` (per-phase) + `project_folder_id` (per-definition); generator must RESOLVE spoken folder names/paths → ids.
- **Unknown (d) answer = MIXED.** Good: one sentence → correctly-typed 4-phase pipeline; refine absorbed as intent (no hand-edited JSON); human-confirm inferred from "pause for me to confirm." MIXED because the generator SILENTLY GUESSED on grey areas (substituted non-existent "Acme" folder → "Project Meridian — Risks" without asking; mapped spoken "/Risks subfolder" onto the whole folder — no such subfolder exists). Operator's two conditions for GOOD: (1) a clarify-as-you-go **grey-area validation loop** (surface every ambiguity — unresolvable folder ref / vague scope / unmapped placeholder / missing tool+skill — for user validation; NO silent substitution); (2) **post-build editability** — tweak → new version (immutability per-version, not per-workflow; `WorkflowDefinition.version` + "no-edit-published" already support republishing).
- **Carry-forward:** Phase 103 (WFAUTH-02) acceptance bars = grey-area validation loop + tweak-to-new-version path (G-2 sketch-gated). Phase 098 (PROJ-02) = bound `folder_scope`/`project_folder_id` + path→id resolution.

**Plan 097-03 progress (Wave 2, unknown b) — COMPLETE:**

- ✓ Task 1 (commit `19f8bdcc`): `render_docx.py` — `build_context` (deterministic `score = int(P)×int(I)` when numeric, else None — NOT an LLM field) + `render` (docxtpl `DocxTemplate.render(jinja_env=SandboxedEnvironment(autoescape=True))` — SSTI containment T-097-08 + XML-safe `&<>` T-097-09) + `assert_integrity` (python-docx re-open T-097-10 + residual-tag scan T-097-11) + `log_pitfall` writer. Render runs LOCAL in the venv (prod render = sealed Docker sandbox, Phase 101). The LLM produces DATA; docxtpl owns the OOXML bytes.
- ✓ Task 2 (commit `b109df5b`): `run_spike.py` — the 6-step end-to-end run (parse → bound-scope retrieve → forced-tool field-map → coverage/cite check → render → integrity) produced `out/risk-register-filled.docx` (real KB → real cited field-map → real openable file, the SC#1 artifact; 5 chunks retrieved, 6 cited rows, 100% coverage, 1 table / 7 rows). Synthetic 1/5/20-row growth → 2/6/21 rows (Pitfall 5, the load-bearing surprise — PASS). `&<>` probe (`Acme & <Corp> risk`) survived as literal text (Pitfall 2 — autoescape contained it). `out/corruption.log` = one row per Pitfall 1–6 (all clean) + Pitfall 7 observe-only (single-version corpus) + pptx/xlsx not-exercised seed rows. `out/unknown-b.md` = verdict **YES / GO**.
- ✓ Task 3 (human-verify checkpoint, **operator-approved 2026-06-09**): operator opened `out/risk-register-filled.docx` in a real editor (Word/LibreOffice) — **NO "needs repair" banner**, risk table grew to **6 risk rows** (one per risk, not a single template row), scalar tags (`project_name`/`report_date`) filled. Blank Score column on the real doc accepted as **expected** (KB states P/I as words High/Med/Low → don't parse to ints for the P×I compute — not a defect). Upgrades Pitfall 3 from "parses via python-docx" to "renders clean in a real editor" — the strongest evidence for unknown (b). Confirmation appended to `corruption.log` + `unknown-b.md`.
- **Unknown (b) answer = YES / GO.** docxtpl is the recommended fill path for trusted project-library templates (the Phase 101 production target). No deviations.
- **Phase 101 carry-forwards:** (i) **worded likelihood/impact → numeric Score mapping** (real KB speaks High/Med/Low → real-doc Score blank by design; prod TMPL-02 needs a deterministic categorical→ordinal map); (ii) **coarse table chunking** (Plan 01) reduced workshop-table risk retrieval — register-style tables need finer chunking so every tabulated risk is independently citable; (iii) **pptx/xlsx variable-row growth still unexercised** (docx-first; python-pptx can't grow tables / openpyxl chart-preservation untested — deferred, logged as Phase 101 UAT rows).

**Plan 097-05 progress (Wave 3, go/no-go conclusion) — COMPLETE:**

- ✓ Task 1 (commit `f5f174bc`): drafted `scripts/spike-097/CONCLUSION.md` — the spike deliverable (SC#3): 4-unknown roll-up (a=YES / b=GO / c=grounding inventory / d=MIXED, each claim citing its `out/` artifact) + recommended `DECISION: GO` + recommended additive-optional `inputs`/`assets`/`folder_scope` schema shape (three open questions settled: `template_derived`→`source` enum value; `Cited` provenance→run OUTPUT only; `folder_scope`→BOUND resolved-id list) + the Phase 101 UAT seed (6 named pitfalls + pptx/xlsx deferrals). No `harness.py` edit, no migration, no `backend/` change.
- ✓ Task 2 (checkpoint:decision resolved 2026-06-09 — operator-confirmed `go-conditional`; finalized this session): updated CONCLUSION.md to **operator-confirmed DECISION: GO** conditional on **Conditions 1–8**. Conditions 1–6 kept; **Condition 7 replaced** with the FULL-native-roster cross-provider version (validate the field-map structured-output across all 7 natives + OpenRouter — NOT the SC#10 representative-4; explicit GLM/MiniMax tool-use-drop + DeepSeek/Moonshot reasoning-truncation traps; provider handling at the service boundary, shared fill path never branches); **Condition 8 added** = living-document feedback loop (optional OUTPUT re-ingestion). Extended the §3 schema recommendation with an **OUTPUT-side dimension** (`output_target_folder` / `reingest_output` / `version_policy` / `provenance`) as the Phase 098 lock candidate (RECOMMENDATION only, zero-migration — leverages the already-shipped `documents.py:402-423`/`:425-449`/`:656` dedup/versioning/reingest infra). Added an "Open design item — living-document feedback loop (SEED-069)" section. `097-05-SUMMARY.md` written (Self-Check: PASS).
- **SEED-069 planted** (`.planning/seeds/SEED-069-living-document-workflow-output-reingestion.md`): workflows that produce evolving artifacts need optional OUTPUT re-ingestion so the next run grounds on the latest version. CRITICAL — the dedup/versioning/reingest infra ALREADY EXISTS; net-new is only thin wiring + a `derived/source` provenance flag (self-feedback amplification guard) + a scoped exception to the CLAUDE.md manual-upload-only rule. Linked to SEED-005 (DM versioning, next milestone) + GOV-02 (provenance receipt, STRETCH 107).

**Phase 097→098 housekeeping (historical — Phase 098 now COMPLETE):** Discuss-phase complete 2026-06-09: `.planning/phases/098-project-binding-server-side-kb-scope-governance/098-CONTEXT.md` committed (`9aae09cb`). 3 gray areas resolved (all operator-accepted): **(1)** output-side schema shapes (`output_target_folder`/`reingest_output`/`version_policy`/`provenance`) **locked-now, behavior-deferred** [D-08]; **(2)** scope-violation = **clip + observable run-log warning** (`scope_violation` event on the existing run-event/`run:{run_id}` channel) + per-phase `folder_scope` **narrow-only enforced at definition-save validate** [D-06/D-07], with the ⊆ assert **GATED no-op when scope is None** to keep Deep byte-identical on the shared `search_documents` path [D-05a]; **(3)** **representative-4** cross-provider in 098, **full native-7 reserved for Phase 101** [D-09]. A 3-agent adversarial verify pass confirmed code seams + source fidelity (0 high) and drove 4 medium precision fixes. **Housekeeping still open:** Phase 097 was never formally run through `/gsd:verify-work 097` + complete — the 098 dependency (097 schema shape) is satisfied by the operator-confirmed CONCLUSION.md, but the 097 verify/complete step remains outstanding. Phase 103 (Workflows page) stays **sketch-gated (G-2)**.

## Deferred Items

Items acknowledged and deferred at the **v3.0 milestone close on 2026-06-21** (37 total from the pre-close `audit-open` sweep). Triaged: none are v3.0 CORE blockers — they are status-label lag on phases that were live-UAT'd after their files were stamped, historical tracking cruft, a satisfied todo, and deferred-by-design seeds.

| Category | Count | Disposition |
|----------|-------|-------------|
| UAT gaps | 4 | 111 + 114 passed (0 open); 116 partial (3 SC#10 cross-provider rows — known non-blocking carry-forward); 119 partial (0 open scenarios). No real pending work. |
| Verification gaps | 3 | 111.1 / 116 / 119 `human_needed` — bookkeeping status never flipped to `passed` after the live UAT was actually run (e.g. the 119 commits record "UAT 1-3 PASS live"). All three are secured + validated. |
| Quick tasks | 19 | Orphaned tracker slugs (`[missing]`) from Mar–Jun 2026 — already-fixed bugs from v2.5–v2.9. Tracking cruft, not v3.0 work. |
| Pending todos | 1 | `spike-nl-workflow-authoring` — satisfied (NL authoring shipped in Phase 103, v2.9). |
| Unimplemented seeds | 10 | Deferred-by-design with re-open triggers: SEED-003/004/040/041/042/043/044/045/046/084. Future-milestone candidates. |

**v2.9 STRETCH phases 105–109 (SCHED-01 / GRID-01 / GOV-02 / PLUG-01 / ROLE-01)** remain backlog carry-forwards (next-milestone candidates).

**Open `surface: Agentic-RAG` reports (roll forward into the v3.1 UAT blast radius):** the carried v2.9 run-honesty / provider-polish reports (BUG-260609-02/-04, BUG-260610-01, BUG-260615-01, `general-chat-intermittent-silent-send-drop`, `minimax-m3-invalid-tool-args-400`, `setting-up-agent-hides-model-activity`). **v3.1 routing note:** `minimax-m3-invalid-tool-args-400` is the re-open trigger for STRETCH Phase 129 (MP-04 MiniMax arg repair); `setting-up-agent-hides-model-activity` + `non-anthropic-generic-code-task-descriptions` are addressed by Phase 122 (TDP-01 task-label parity) + STRETCH Phase 128 (TDP-02). Cross-check these at `/gsd:discuss-phase` per the reported-bugs mandate.

## Roadmap shape (v3.1, created 2026-06-21)

**CORE (committed) — Phases 120-124:**

| Phase | Name | REQ-IDs | SC# | Flags |
|---|---|---|---|---|
| 120 | Collision Fix + Context Isolation | COLL-01, CTX-01 | 4 | G-5 (`threads.py`/`agent_loop.py`); SC#10 |
| 121 | One Front Door for Workflows (IA) | IA-01 | 3 | G-2 sketch; UI hint; SC#10 |
| 122 | Cross-Provider Trust & Honesty Parity | MP-01, MP-02, MP-03, TDP-01 | 5 | G-5 (gateway/adapter); SC#10 (eval axis, MP-03) |
| 123 | Skill Triggering Quality | TRIG-01, TRIG-03, CTX-03 | 5 | G-5 (`context_window.py`/`agent_loop.py` trim); SC#10 |
| 124 | Workflow Studio UX — Soul + Strict↔Loose | WUX-01, WUX-02 | 4 | G-2 sketch (both); UI hint; G-5 (`PhaseTimeline.tsx`/`PhaseCard.tsx`) |

**STRETCH (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 precedent) — Phases 125-131:**

| Phase | Name | REQ-IDs | SC# | Depends |
|---|---|---|---|---|
| 125 | Self-Improve Proposer (description-only) | SI-02 | 3 | 122 + 123 |
| 126 | Smart-Dispatch Relevance Pre-Filter | TRIG-02 | 3 | 123 |
| 127 | Gauntlet Pip-Strip + Quiet Idle Cards | WUX-03 | 2 | 124 (G-2 sketch; UI hint) |
| 128 | Live Description Before tool_start | TDP-02 | 2 | 122 |
| 129 | MiniMax/OpenRouter Arg Repair | MP-04 | 2 | 122 |
| 130 | template_input Resolver Run-Scope | COLL-02 | 2 | 120 |
| 131 | Non-Python Skill-Script Honesty | SRH-01 | 3 | 120 (off COLL-01 seam) |

- **Coverage:** 19/19 requirements mapped (12 CORE + 7 STRETCH); 0 unmapped. Every requirement → exactly one phase. *(Phase 131 / SRH-01 folded in 2026-06-22 — SEED-044 Layer 1, the honesty precursor to v3.2 DISC-01; surfaced by a JS-skill-import investigation.)*
- **Sequencing rationale:** COLL-01 (confirmed LIVE bug, Mechanism A) sequenced EARLIEST (Phase 120), paired with CTX-01 (same collision/context-isolation fix). MP-03 (per-provider scoreboard) lands in the SAME phase as MP-01/MP-02 (122) so the scoreboard substrate gates any MP-02 tier flip. TRIG-01 (headline skill-quality deliverable) gets its own phase (123) with TRIG-03 + CTX-03 as adjacent skill-triggering items. WUX-01/WUX-02 (G-2 sketch-gated UX re-skin) cluster in 124; IA-01 (also G-2/frontend) lands first in 121 as the "one front door" prerequisite the WUX re-skin builds on.
- **SC#10 (cross-provider mandate, EVAL axis per MP-03):** flagged on every phase touching streaming / agent loop / provider routing / UI state — 120, 121, 122, 123, 124 (+ dependent STRETCH 125, 126, 128, 129).
- **UI hint:** 121, 124 (CORE) + 125, 127 (STRETCH).
- **G-2 sketch-gated:** 121 (IA-01), 124 (WUX-01/02) + 127 (WUX-03). `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`.
- **G-5 hot files (audit at discuss-phase):** `backend/app/api/threads.py` (firing → extraction due; 120/121 thread/composer surface — do NOT grow it), `context_window.py`/`agent_loop.py` trim path (CTX-01 `_reconstruct_history` origin filter, CTX-03 trim-pin), `PhaseTimeline.tsx`/`PhaseCard.tsx` (shared with the live harness — re-run replay tests in 124/127), the gateway/adapter boundary (122/128/129).
- **Red line:** never fork the shared path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

Roadmap detail: `.planning/ROADMAP.md` (active v3.1 section). Requirements + traceability: `.planning/REQUIREMENTS.md`. Scope source: `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md`.

## Roadmap shape (v2.9, created 2026-06-08)

| Phase | Name | REQ-IDs | SC# |
|---|---|---|---|
| 097 | Spike — Risk-Register Template-Fill + Authoring Feel | — (SEED-051; informs PROJ/TMPL/WFAUTH) | 4 |
| 098 | Project Binding + Server-Side KB Scope Governance | PROJ-01, PROJ-02, GOV-01 | 4 |
| 099 | Workflow ↔ Skill Composition | WFSKILL-01 | 3 |
| 100 | Ephemeral Template Upload | TMPL-01 | 3 |
| 101 | Template-Fill + Integrity Validation | TMPL-02, TMPL-03 | 4 |
| 102 | Reusable Validation-Gate Library + Output-Quality Gate | GATE-01, QUAL-01 | 3 |
| 103 | Workflows Page + Authoring API + NL Authoring | WFAUTH-01/02/03/04 | 4 |
| 104 | PM Flagship Content Pack | PM-01 | 3 |
| 105 (STRETCH) | Scheduled/Recurring Triggers + Budget Caps | SCHED-01 | 3 |
| 106 (STRETCH) | Citation-Traceable Grid Renderer | GRID-01 | 2 |
| 107 (STRETCH) | Per-Run Provenance Receipt View | GOV-02 | 2 |
| 108 (STRETCH) | Plugin Contract Lock — phase_type + file_preview | PLUG-01 | 2 |
| 109 (STRETCH) | Operator/Admin Role Tier | ROLE-01 | 2 |

- **SC#10 (cross-provider mandate) flagged on:** 098, 099, 101, 102, 103, 104 (workflow-run-bearing) + 106 (batch fan-out).
- **UI hint:** 100, 101, 103, 106, 107, 108.
- **G-2 sketch-gated:** 103. **G-6 failure-mode UAT rows:** 101.

## Milestone scope (locked 2026-06-08)

v2.9 = **Workflow Studio** — a value-first reframe of the provisional "Plugin Contract & Extension System." The headline insight from the deep research brief: v2.9 is ~80–90% composition of shipped v2.8 harness primitives; net-new is *authoring UX + a project/scope binding + ephemeral template upload + a small validation-gate library + the Workflows page* — NOT a new runtime, NOT the Plugin Contract.

**5 scope forks resolved:**

1. Scheduled/recurring execution → **DEFERRED** (hard-depends on a budget/spend-ceiling system that doesn't exist; v3.4 territory). v2.9 = author + run on demand. *(Carried as STRETCH Phase 105 with the hard budget prerequisite.)*
2. Self-serve global sharing + operator role tier → **DEFERRED** (v3.1). v2.9 keeps drafts + per-user publish (RLS already enforces). *(Carried as STRETCH Phase 109.)*
3. Template-fill magic → **BOTH** patterns: trusted project-library templates use docxtpl/Jinja; arbitrary uploads use non-Jinja run-replace. Spike sets how far the arbitrary path is pushed. *(Phase 097 spike → Phase 101 build.)*
4. Citation-traceable grid renderer → **STRETCH**. *(Phase 106.)*
5. PM flagship demo → **single template-fill** (status report from KB) as the spike + acceptance bar; standup-to-artifacts cascade = showcase content after primitives proven. *(Phase 097 spike + Phase 104 content pack.)*

Plugin Contract is OFF the critical path (STRETCH: lock `phase_type` + `file_preview` on flagship telemetry + one PPTX preview reference plugin → Phase 108). Connectors (email/OneDrive/GDrive) → SEED-013/014 (v3.3/v3.4). **Enhanced Document Structure** (M-Files/Doxis basics, SEED-005) = NEXT milestone after v2.9 (operator-confirmed 2026-06-08).

Research brief: `.planning/research/v2.9-EXPLORATION.md` (+ 6 dimension reports A–F under `.planning/research/v2.9-exploration/`).

## Seeds folded / routed (v2.9, /gsd:new-milestone seed scan)

- **SEED-051** (generalized NL→workflow authoring) → **FOLDED** as v2.9 CORE (spike-first — Phase 097 answers the 4 unknowns that become the schema; NL authoring lands in Phase 103).
- **SEED-037** (workspace panel office/PDF/PPTX viewing + download) → partial overlap with template preview / `file_preview` plugin → STRETCH (Phase 108).
- **SEED-013** (external integrations: API + MCP + webhooks) → connectors deferred; re-open trigger: first `data_source` plugin design (first reference = read-only GDrive/OneDrive folder→KB sync).
- **SEED-014** (automations & routines) → scheduled execution + scheduled ingestion deferred to v3.4 (Phase 105 only covers on-demand-budget-gated scheduling if promoted).
- **SEED-005** (DM / M-Files-Doxis basics) → **NEXT milestone after v2.9** (Enhanced Document Structure).
- **SEED-040 / SEED-012** (model-registry self-service / admin-operator UI) → operator tier + metadata-model-flexibility deferred (v3.1 / DM milestone; Phase 109 only if global sharing becomes a headline).
- **SEED-052** (interactive todo-driven HITL) → adjacent to `llm_human_input` review-with-provenance checkpoints; noted (Phase 101 review surface + Phase 102 gates).

## Open reported-bugs sweep (2026-06-08, /gsd:new-milestone mandate)

3 open `surface: Agentic-RAG` reports — **none fold into v2.9 CORE** (all Deep-mode chat / provider / live-execution polish, outside the Workflow Studio authoring domain). They sit in the SC#10 cross-provider blast radius (workflows run in a thread, share the composer + live-execution panel) → v2.9 UAT must not regress them.

| Report | Sev | Disposition |
|---|---|---|
| `general-chat-intermittent-silent-send-drop` | minor | leave open — tracked as SEED-055 residual |
| `minimax-m3-invalid-tool-args-400` | minor | leave open — provider-specific; MiniMax low-priority; re-open trigger: cross-provider workflow UAT surfaces it |
| `setting-up-agent-hides-model-activity` | major | leave open — Deep-mode dispatch-latency banner; candidate for a focused Deep-UX polish phase |

## Workflow guardrails firing (v2.9)

- **G-2 (sketch-before-plan) FIRES** — Workflows page / NL-form-editor / live read-only graph are live UI (Phase 103); `/gsd:sketch` before `/gsd:spec-phase`/`/gsd:discuss-phase`. `sketch-findings-agentic-rag` already names these surfaces (sketches 012 workflows-page + 013 workflow-builder processed — confirm/extend).
- **G-6 (failure criteria upfront)** — each phase SPEC carries a "How we'd know this failed" section; template-fill known failure modes (run-split miss, XML corruption, pptx row-growth, xlsx chart strip, merged-cell mis-write, produced-file-won't-open) become UAT rows up front (Phase 101).
- **G-1/G-5 (hot-file caps)** — authoring work is greenfield (new page, new API router, additive optional model fields); it does NOT pile onto the G-5-firing hot files (`backend/app/api/threads.py`, `backend/app/services/anthropic_service.py`). Engine additions are additive seams on `backend/app/services/harness/phase_types.py` + `backend/app/models/harness.py`. `backend/app/api/threads.py` extraction remains due (carried — do not grow it in v2.9).
- **Red line** — workflows COMPOSE the shipped harness / agent-loop / provider-gateway; never re-implement. Deep Mode stays byte-identical. No new runtime.

## Accumulated Context

### Roadmap Evolution

- **Phase 111.1 INSERTED after Phase 111 (2026-06-15):** "Configurable / Multi-Provider Embeddings (incl. local Ollama + LM Studio)" — embedding-provider picker + local presets + re-embed-on-change lifecycle; new reqs **EMBED-01..06**; depends on Phase 111 (reuses its `lmstudio` provider plumbing); G-2 sketch fires (Settings UI). Lands before the DM read-path phases (113-119). Sourced from a 5-agent investigation (the `embedding-flexibility-scoping` workflow). **Decision:** keep embedding flexibility OUT of Phase 111 (different domain = retrieval substrate, not the metadata LLM; plus the fixed-`vector(1536)`/HNSW dimension + destructive-re-embed landmine) → its own phase. **Retires SEED-048.** **SEED-048 correction:** embeddings are NOT OpenAI-hardwired today — `embedding_model`/`embedding_base_url`/`embedding_api_key`/`embedding_dimensions` are already configurable Settings with UI controls (`SettingsPage.tsx:934-950`); what's missing = a provider picker, local presets, the re-embed lifecycle, and a fix for the `embed_chunks` `user_settings`-drop bug (folded in as EMBED-04). The 111.1 plan must VERIFY these findings against live code.

**Open blockers:** None. (Resolved 2026-06-08: Phase 097 Plan 01 Task 3 human-action checkpoint — operator confirmed folder `75755ec9-5ba7-495b-ad93-7500011cf6f2` "Project Meridian — Risks" and ingested a synthetic risk corpus to ground it; `out/spike-config.json` written + committed `61025148`.)

**Key decisions** (full log in PROJECT.md → Key Decisions): D-v2.8-01 (harness now; Plugin Contract was deferred to v2.9 — **now reframed**: Plugin Contract OFF the v2.9 critical path, value-first Workflow Studio instead, lock `phase_type`+`file_preview` on flagship telemetry as STRETCH Phase 108), GATEWAY-01 (one shared provider gateway, Deep byte-identical — workflows consume it, never re-implement), D-094-UNIFY (panel = single live-execution surface for Deep + Harness), D-095.1 (run honesty = projection/classification over existing data; provider handling at the gateway boundary). New v2.9 design anchors from research: "project = folder" as the single scope object; immutability = "no-edit-published" not "no-grow-format" (additive optional fields keep old workflows validating); LLM produces DATA, deterministic code produces the FILE; output-quality judge gate is a HARD publish blocker. **Spike 097 Plan 04 (unknown d, 2026-06-09):** describe→refine→publish feel = **MIXED** — the authoring mechanism works (grounded one-shot generation + conversational refine over the strict schema yields correctly-typed, schema-valid drafts) but Phase 103 (WFAUTH-02) MUST add (1) a clarify-as-you-go **grey-area validation loop** — surface every ambiguity (unresolvable folder ref / vague scope / unmapped placeholder / missing tool+skill) for explicit user validation, NO silent substitution (the spike caught the generator silently mapping a non-existent "Acme" folder and a non-existent "/Risks subfolder") — and (2) a **tweak→new-version** authoring path (editability = a versioning op; immutability is per-version, not per-workflow — confirms the "no-edit-published" anchor). Unknown (c): folder tree + tool names + template placeholders are MUST-HAVE authoring grounding; skill registry nice-to-have; PROJ-02 bound `folder_scope`/`project_folder_id` confirmed needed (scope leaked into prompt text for lack of a schema field).

**Deferred items carried from v2.8 close (2026-06-07):** 43 acknowledged items — full inventory in `.planning/milestones/v2.8-MILESTONE-AUDIT.md` (and the prior STATE.md in git history). Headline: CONC-01 partial → SEED-065-B (cross-tab GET p95 ~3 s residual); PARITY-01 re-deferred; 11 dormant forward seeds (SEED-002/003/004/005/040/041/042/043/044/045/046); SEED-048/050/057 carried/active.

**Planned Phase:** 112 (metadata-enrichment-document-detail-panel-manual-edit) — 4 plans — 2026-06-17T20:46:10.826Z

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 118 P02 | ~30 min | 2 tasks | 3 files |
| Phase 118 P03 | 12min | 2 tasks | 5 files |
| Phase 118 P05 | 10min | 2 tasks | 5 files |
| Phase 119 P01 | 11min | 2 tasks | 8 files |
| Phase 119 P02 | 7min | 3 tasks | 7 files |
| Phase 120 P01 | ~4min | 2 tasks (TDD) | 3 files |
| Phase 120 P02 | ~25min | 2 tasks (1 TDD) | 8 files |

## Decisions

- [Phase ?]: 118-02: classification-rules routes return RuleResponse(**row) so live CRUD tests can call coroutines directly (read .is_global/.id/.enabled); service imported as a module to avoid create_rule shadowing
- [Phase ?]: 118-02: removed 5 stale xfail markers in test_118_rule_crud.py so the CRUD tests are genuinely GREEN (xpass would silently mask a future regression)
- [Phase ?]: Phase 118-03: classification rule-eval spliced into ingest_document before the single persist write — own+global leak-safe read (no auth.uid in the BG task, D-118-8), first-match-wins ONE _classification suggestion, NEVER a folder move (CLASS-02)
- [Phase 118]: Phase 118-03: accept/dismiss endpoints — accept records prior_folder_id, re-validates the target folder, moves, audits classification.apply AFTER the move; dismiss clears; Undo reuses the existing move endpoint (CLASS-03 reversible)
- [Phase 119]: Phase 119-01: A1 LIVE — document_relationships FKs are ON DELETE CASCADE; a full endpoint delete cascades the edge away, so the only broken state is an orphaned old-version edge (lineage has no current is_latest). Broken predicate anchors on _latest_exists_anywhere, not the resolver None (which degrades to a stale old row).
- [Phase 119]: Phase 119-01: A3 PINNED LIVE — PostgREST deep-jsonb path for the _-leading key is the DOTTED form metadata->_classification->>status (quoted-arrow form returns nothing).
- [Phase 119]: Phase 119-01: masking != deletion (D-119-3) — an alive-but-unreadable target is masked, NOT broken; the existence probe is content-free (count only), no cross-user leak; DMF-03 non-gate confirmed (A8).
- [Phase 119]: Phase 119-02: D-119-2 navigation triad owned in ONE plan (App.tsx ActiveView union + nav-items ShieldCheck entry + ChatLayout governance branch) — clicking Governance renders GovernancePage, not KnowledgeHealthPage; the Phase 118 built-but-unreachable lesson applied.
- [Phase 119]: Phase 119-02: GovernanceRow is link-out-only (D-119-6) — clones only HealthDocumentRow chrome, imports no document-mutation helper; the whole row is a keyboard-operable button → DocumentDetailPanel. A5 lighter reuse: top-10 rows + honest backend total (no PaginationControls); D-119-9 initializedTabsRef no-refetch-loop guard carried verbatim into the 3-stacked-card page (Refresh clears it). Frontend-only, no migration/package/write path; threads.py untouched.
- [Phase 120]: Phase 120-01 (COLL-01): Option 2 lazy seed in the execute_code handler (tool_dispatcher.py) chosen over Option 1 (eager seed in agent_loop.py) — keeps the G-5 hot file agent_loop.py untouched (it does not import sandbox_manager), the session already exists at :868, and the SAME handler serves Deep + Harness so one seed site covers both. Guard via ctx._output_baseline_seeded (per-RUN not per-cell); run_in_threadpool-wrapped (D-v2.5-01).
- [Phase 120]: Phase 120-01 (COLL-01): snapshot_output_baseline SEEDS the existing SHA-256 hash-dedup baseline (no new filename heuristic — explicitly disproven by COLL-03-EVIDENCE §Refinement 1: the live 2 files shared ONE execution_id). D-120-02 honored — the helper never clears/deletes /sandbox/output/, is fully try/except-wrapped (empty/failure → {} = legacy behavior), and only stops RE-EMITTING pre-existing files. No schema/package change (stdlib hashlib/os/tempfile).
- [Phase 120]: Phase 120-02 (CTX-01): migration 076 AUTHORED only (NOT applied — Plan 03 applies + regenerates full-schema.sql); `messages.origin text NOT NULL DEFAULT 'deep'` + CHECK, no new RLS policy (inherits thread-owner policy, precedent 050). The DEFAULT 'deep' is load-bearing — fills legacy rows so the Deep neq() filter avoids the NULL three-valued-logic drop (Pitfall 1).
- [Phase 120]: Phase 120-02 (CTX-01): asymmetric origin filter extracted to module-level pure helper `_apply_origin_filter(history_q, agent_mode)` — Deep/Explorer neq('origin','harness') (replays deep + legacy), Harness eq('origin','harness') (strict, A1 defense-in-depth per D-120-06). A SINGLE shared WHERE clause (no per-provider fork); origin kept OUT of .select() projection (Pitfall 4) so _reconstruct_history is unchanged and pure-Deep threads return today's exact set (SC#4 byte-identical). Owner/thread .eq scope never relaxed (V4).
- [Phase 120]: Phase 120-02 (CTX-01): every enumerated HARNESS insert site tags origin='harness' (db/runs.py shared helper kwarg, harness_engine success/failure persists + raw expiry INSERT positional $4 (never f-stringed, T-120-06) + disposition prompt, phase_types llm_human_input prompt); api/runs.py ask_user_response is mode-aware (default 'deep', 'harness' ONLY on the confirmed workflow_runs-fallback branch, A2 safe-direction). api/threads.py:1020 user row UNTOUCHED (G-5); full-schema.sql NOT touched.

## Operator Next Steps

- v3.1 roadmap created (CORE 120-124 + STRETCH 125-130). Next: `/gsd:discuss-phase 120` (Collision Fix + Context Isolation) — cross-check `.planning/reported-bugs/*.md` (`status: open` + `surface: Agentic-RAG`) per the discuss-phase mandate. G-2 sketch fires on 121/124 before spec/discuss.
