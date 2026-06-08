---
gsd_state_version: 1.0
milestone: v2.9
milestone_name: Workflow Studio
status: executing
last_updated: "2026-06-09T00:15:00Z"
last_activity: 2026-06-09 -- Phase 097 Plan 04 complete (unknowns c+d; unknown-d.md + 097-04-SUMMARY.md committed)
progress:
  total_phases: 13
  completed_phases: 0
  total_plans: 5
  completed_plans: 3
  percent: 60
---

# Project State

> `total_phases: 8` = the CORE committed scope (Phases 097–104, incl. the spike). STRETCH Phases 105–109 (SCHED-01 / GRID-01 / GOV-02 / PLUG-01 / ROLE-01) are optional and excluded from the progress denominator until promoted. Full phase detail in `.planning/ROADMAP.md` → "## v2.9 Workflow Studio".

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-08 — v2.9 Workflow Studio milestone started)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Current focus:** Phase --phase=097 — --name=spike-risk-register-template-fill-authoring-feel

## Current Position

Phase: --phase=097 (--name=spike-risk-register-template-fill-authoring-feel) — EXECUTING
Plan: 3 of --plans=5 COMPLETE — **Wave 1 fully done** (097-02 unknown a + 097-04 unknowns c+d); next = Wave 2 (097-03 unknown b), then Wave 3 (097-05 go/no-go)
Status: Executing Phase --phase=097 — Plans 01 + 02 + 04 done (unknown (a) YES; unknown (c) grounding inventory + unknown (d) feel = MIXED); only unknown (b) remains before the go/no-go
Last activity: 2026-06-09 -- Phase 097 Plan 04 complete (unknowns c+d; unknown-d.md + 097-04-SUMMARY.md committed)

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

**Next action:** `/gsd:execute-phase 097` (continue — Wave 2 Plan 097-03 unknown b [docxtpl end-to-end fill + SSTI-contained render + integrity re-open + row-growth + Pitfall 1–6 log], then Wave 3 Plan 097-05 go/no-go). Phase 097 is a **throwaway spike (SEED-051)** — it answers the 4 schema-shaping unknowns and its output BECOMES the recommended `inputs`/`assets`/`folder_scope` schema shape; **no production schema locks before the spike.** Wave 1 is now fully done (a + c + d answered); only unknown (b) remains. Plan 05 (go/no-go) has a human checkpoint. Throwaway code lives in `scripts/spike-097/` (off the hot files). Single provider (Anthropic native; OpenAI-strict documented pivot). Downstream: Phase 103 (Workflows page) is **sketch-gated (G-2)** — run `/gsd:sketch` before `/gsd:spec-phase`.

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

**Open blockers:** None. (Resolved 2026-06-08: Phase 097 Plan 01 Task 3 human-action checkpoint — operator confirmed folder `75755ec9-5ba7-495b-ad93-7500011cf6f2` "Project Meridian — Risks" and ingested a synthetic risk corpus to ground it; `out/spike-config.json` written + committed `61025148`.)

**Key decisions** (full log in PROJECT.md → Key Decisions): D-v2.8-01 (harness now; Plugin Contract was deferred to v2.9 — **now reframed**: Plugin Contract OFF the v2.9 critical path, value-first Workflow Studio instead, lock `phase_type`+`file_preview` on flagship telemetry as STRETCH Phase 108), GATEWAY-01 (one shared provider gateway, Deep byte-identical — workflows consume it, never re-implement), D-094-UNIFY (panel = single live-execution surface for Deep + Harness), D-095.1 (run honesty = projection/classification over existing data; provider handling at the gateway boundary). New v2.9 design anchors from research: "project = folder" as the single scope object; immutability = "no-edit-published" not "no-grow-format" (additive optional fields keep old workflows validating); LLM produces DATA, deterministic code produces the FILE; output-quality judge gate is a HARD publish blocker. **Spike 097 Plan 04 (unknown d, 2026-06-09):** describe→refine→publish feel = **MIXED** — the authoring mechanism works (grounded one-shot generation + conversational refine over the strict schema yields correctly-typed, schema-valid drafts) but Phase 103 (WFAUTH-02) MUST add (1) a clarify-as-you-go **grey-area validation loop** — surface every ambiguity (unresolvable folder ref / vague scope / unmapped placeholder / missing tool+skill) for explicit user validation, NO silent substitution (the spike caught the generator silently mapping a non-existent "Acme" folder and a non-existent "/Risks subfolder") — and (2) a **tweak→new-version** authoring path (editability = a versioning op; immutability is per-version, not per-workflow — confirms the "no-edit-published" anchor). Unknown (c): folder tree + tool names + template placeholders are MUST-HAVE authoring grounding; skill registry nice-to-have; PROJ-02 bound `folder_scope`/`project_folder_id` confirmed needed (scope leaked into prompt text for lack of a schema field).

**Deferred items carried from v2.8 close (2026-06-07):** 43 acknowledged items — full inventory in `.planning/milestones/v2.8-MILESTONE-AUDIT.md` (and the prior STATE.md in git history). Headline: CONC-01 partial → SEED-065-B (cross-tab GET p95 ~3 s residual); PARITY-01 re-deferred; 11 dormant forward seeds (SEED-002/003/004/005/040/041/042/043/044/045/046); SEED-048/050/057 carried/active.

**Planned Phase:** 097 (Spike — Risk-Register Template-Fill + Authoring Feel) — 5 plans — 2026-06-08T18:24:22.199Z
