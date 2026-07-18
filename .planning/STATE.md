---
gsd_state_version: 1.0
milestone: v3.4
milestone_name: Multi-Tenancy & Org Access
status: planning
last_updated: "2026-07-18T11:20:33.743Z"
last_activity: 2026-07-18 — v3.4 ROADMAP.md created (9 CORE 160-168 + 5 STRETCH 169-173; 29/29 requirements mapped, 0 unmapped)
progress:
  total_phases: 27
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

> **Scope note:** **v3.2 Skill Eval Studio + Self-Improving SHIPPED + archived 2026-07-10** (started 2026-06-28; close-out in `.planning/milestones/v3.2-ROADMAP.md` + `MILESTONES.md`; FILE-01/Phase 144 deferred → v3.3). Roadmap created: CORE Phases 132-137 + STRETCH Phases 138-143 (gated behind CORE — v2.9 105-109 / v3.1 125-131 precedent). Numbering continues from v3.1's last phase (131). Scope source: `.planning/REQUIREMENTS.md` (8 CORE + 6 STRETCH); brief `.planning/PRDs/v3.1-skill-studio-eval.md`. **v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers SHIPPED + archived 2026-06-28** (CORE 120-124+123.1; STRETCH 127/128/129 shipped, 125/126/130/131 deferred as carry-forwards now folded into v3.2 STRETCH; close-out in `.planning/milestones/v3.1-ROADMAP.md` + `MILESTONES.md`). The v3.x PRD roadmap (authoritative map: `.planning/PRDs/SEQUENCE.md`) is unchanged. **Everything below the "Roadmap shape (v3.2...)" block is v3.1-and-earlier accumulated context, retained per the milestone-transition convention.**

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-18 — v3.3 Operator UX SHIPPED + archived)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Current focus:** **v3.4 Multi-Tenancy & Org Access — ROADMAP APPROVED 2026-07-18** (9 CORE Phases 160-168 + 5 STRETCH Phases 169-173; 29/29 requirements mapped; migrations from slot 104). The load-bearing one-way RLS door. **Deployment-flexibility guarantee baked into Phase 160's ADR** (SC#4: solo-local / small-VPS / medium-SaaS / enterprise-on-prem all stay a pure env-var switch; local never breaks; org-settings forward-compatible with per-org provider config — see SEED-120). **Seeds planted at approval:** SEED-120 (per-org BYO provider keys/config), SEED-121 (provider key pooling at scale), SEED-122 (local/small-model capability validation via the eval studio); capacity-sizing points at existing SEED-001/071. Next: `/gsd:discuss-phase 160` (or `/gsd:plan-phase 160`). Prior: v3.3 Operator UX shipped + archived 2026-07-18 (tag `v3.3`).

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-07-18 (44 open `audit-open` artifacts — all noise or by-design backlog; none block v3.3):

| Category | Count | Disposition |
|----------|-------|-------------|
| Seeds (dormant) | 9 | By-design v3.4+ backlog — 003 deploy-flexibility, 004 org-multi-tenancy, 040 model-registry-self-service, 041 conversation-compaction, 042 chat-input-modalities, 043 sandbox-package-mgmt, 045 ui-ux-polish, 046 library-health, 084 starter-workflow-library. Preserved with re-open triggers. |
| Quick tasks (missing) | 22 | Stale legacy index refs (Jan–May 2026); underlying files gone. Noise, not open work. |
| Todo (empty) | 1 | Malformed/empty entry. Noise. |
| UAT gaps | 7 | All terminal-positive (resolved / passed / accepted) — none failing. |
| Verification gaps | 5 | All `human_needed` — satisfied by phase-level live UAT this milestone. |

**Open reported bugs rolling forward** to a planned post-v3.3 chat-polish phase (none were folded into 146–159): BUG-260708-01/-02 (major), BUG-260714-01 (major), BUG-260712-02, BUG-260718-02/-03/-04, BUG-260609-02/-04, BUG-260610-01, BUG-260623-01, BUG-260706-01, BUG-260707-03; deferred BUG-260626-02/-03, BUG-260711-02; external BUG-260714-02 (OpenRouter). BUG-260718-01 CLOSED (folded into 159).

## Current Position

Phase: 160 of 168 CORE (Tenancy-Model ADR) — roadmap created, ready to plan
Plan: —
Status: Roadmap created — ready to plan Phase 160 (`/gsd:discuss-phase 160` or `/gsd:plan-phase 160`)
Last activity: 2026-07-18 — v3.4 ROADMAP.md created (9 CORE 160-168 + 5 STRETCH 169-173; 29/29 requirements mapped, 0 unmapped)

Progress: [░░░░░░░░░░] 0%

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260611-irx | Per-process log filename — fix Windows multi-worker RotatingFileHandler rollover crash (WinError 32) | 2026-06-11 | `b5e916e2` | | [260611-irx-worker-log-rotation-pid](./quick/260611-irx-worker-log-rotation-pid/) |
| 260630-226 | Chat tool-card live-state de-duplication — active tools rest as the unified essence line (Variant B merged pill, body click-to-expand) + remove 3 loose duplicate lines below the run card (SEED-098) | 2026-06-30 | `e3ff8623` | | [260630-226-chat-tool-card-live-state-de-duplication](./quick/260630-226-chat-tool-card-live-state-de-duplication/) |
| 260705-hz1 | Fix SEED-102 — reverse the load_skill name-collision tie-break so an is_system built-in wins over a same-named owned row (`_handle_load_skill`, tool_dispatcher.py) + regression test | 2026-07-05 | `244668f0` | Verified — 19/19 green (independently re-confirmed after a mid-session tool outage cleared); plan-checked 0 blockers (2 passes); scope-contained (`git show --stat` = exactly 2 files) | [260705-hz1-fix-seed-102-reverse-the-name-collision-](./quick/260705-hz1-fix-seed-102-reverse-the-name-collision-/) |
| 260705-nfu | Fix silent data-loss bug in skill ZIP import — one colliding flattened filename (e.g. duplicate `__init__.py` from different folders) used to throw an unhandled exception that killed the rest of the upload loop, silently dropping every later file (confirmed live: the real imported docx skill was missing 6 files, incl. its whole templates/ folder). `_upload_skill_files` is now per-file resilient (try/except, logs, returns errors) + `import_skill` de-dups colliding flattened names (`_dedup_flattened_name`) before upload; sync-path failures surface via the existing `errors` response channel, background-path failures are logged. Folder-tree fidelity itself stays unchanged/deferred. | 2026-07-05 | `0402fa6b` | Verified — 18/18 new+existing tests green + 37/37 across the full skills suite (independently re-run after Docker/backend came back up); plan-checked 0 blockers (2 passes, 1 trivial self-corrected); scope-contained to `skills.py` + its test file | [260705-nfu-fix-a-silent-data-loss-bug-in-skill-zip-](./quick/260705-nfu-fix-a-silent-data-loss-bug-in-skill-zip-/) |

### Recent Completed Phases

**Guardrail overrides:**

- **G-5 / Phase 163 (2026-07-18, roadmap-approval — v3.4 crux):** `backend/app/api/threads.py` is the most-fired G-5 hot file (ledger: "G-5 fires — extraction due") and Phase 163 (the atomic RLS + user-JWT-client crux) threads `org_id` through its ~1850-LOC `send_message`. G-5's letter wants a *dedicated* refactor phase before the feature; the roadmap instead sequences the extraction as **Wave 0 of 163** (operator-approved at roadmap sign-off) to keep the 160–168 numbering, with a HARD gate: **no `org_id` touches `send_message` until the extraction lands + proves Deep byte-identical.** The split-vs-bundle call (promote to a standalone phase 163.x if the extraction proves large) is **deliberately deferred to `/gsd:plan-phase 163`**, where the extraction's true size is measurable — the more rigorous point to decide it than blind at roadmap time. Safety property holds either way. Recommendation on record was the dedicated phase; operator chose bundle-now / decide-at-plan-time. Mirrors the 147/149 override shape; the extraction refactor is finally being done (not deferred again), just co-located with the crux.
- **G-5 / Phase 149 (2026-07-12, plan-phase):** `backend/app/api/threads.py` (ledger: "G-5 fires — extraction due") is touched by plan 149-06 Task 3 with a minimal in-place fallback-notice guard at the single shared model-resolution point for the locked D-149-10 enabled-enforcement decision. Accepted at plan verification (operator-confirmed): guard only, no new endpoint, no file growth beyond the guard, no per-provider fork, shared SSE emitter untouched — all new operator endpoints live in `admin.py`. Mirrors the Phase-147 override shape. The threads.py extraction refactor remains due.
- **G-5 / Phase 147 (2026-07-11, plan-phase):** `backend/app/api/threads.py` (ledger: "G-5 fires — extraction due") is touched by plan 147-04 Task 2 with a minimal in-place workflow-kickoff guard for the D-05 workflows kill-switch. Accepted at plan verification: conditional guard only, no new endpoint, no file growth beyond the guard — all new operator endpoints live in `admin.py`. The threads.py extraction refactor remains due.

**Phase 156 — Everyday UX Polish (STRETCH) (POLISH-01) — COMPLETE (2026-07-16).** 4/4 plans (Wave 0 shared `threadGroups` engine → Wave 1 permanent 58px icon rail + dedicated `ChatHistoryColumn` → Wave 2 hand-rolled ⌘K palette [no `cmdk`] → Wave 3 mobile drawer search + optional Date⇄Folder toggle) + an operator-requested **collapsible-layout refinement** (`8486e0c3`: pinned `☰` rail-expand 58⇄210 [NOT hover-driven] + fold-away history + `▷` reopen, both persisted). VERIFICATION `verified` (10/10 code truths + all 5 felt-experience items live). **verify-work 9/9 PASS** (`156-UAT.md` — operator batch-confirm of the live Chrome-DevTools UAT: 399 threads / 7 folders, both themes, zero h-overflow 390→3440px). **secure-phase `threats_open: 0` — 6/6 CLOSED** (`156-SECURITY.md`: 4 `mitigate` verified in code [T-156-01 XSS `dangerouslySetInnerHTML`=0 / T-156-03 Radix focus-trap / T-156-05 operator-shield outside `NAV_ITEMS` / T-156-SC no-`cmdk`] + 2 `accept` [T-156-02/04 client-not-a-trust-boundary]; short-circuit — register@plan-time, grep+lock-test verified; frontend-only, 11 files, no backend/py/auth). **POLISH-01 → complete; BUG-260711-01 `folded → closed`** (`verified_closed_by: 156` — the thin rail verifiably stops starving the history column at 399-thread scale). Frontend-only — NO backend/migration/cloud-parity. **Next: STRETCH 157 (Deployment Presets & Runbook, DEPLOY-01) / 158 (First-Run Install Wizard, DEPLOY-02) — gated behind CORE + budget; `/gsd:discuss-phase 157` when resumed.**

**Phase 153 — Inline Citations (CITE-01) — COMPLETE (2026-07-15).** 5/5 plans, all TDD, sequential on main tree. VERIFICATION `passed`; HUMAN-UAT 7/7 (0 issues) operator-accepted on the **Anthropic `claude-sonnet-5` SC#10 proof** (152 precedent — the native provider the research flagged for the mid-list-system-drop trap; dual-channel `active_system_prompt`+`messages[0]` injection survived, markers rendered). DB set-membership corroborated live (thread `c7a3eed5`: markers `[1..9]` = 9 `source_refs`, **0 out-of-range**). SECURE-PHASE **`threats_open: 0` — 27/27 CLOSED** (`153-SECURITY.md`, `539b1f0d`): 23 `mitigate` verified in code + 4 `accept` justified; `threads.py` + `StreamsProvider.tsx` confirmed absent from the phase diff (D-08/D-14/G-5 RED LINES held); 0 new deps. **RED LINES held; no migration, no new package.** **Seeds planted 2026-07-15:** SEED-118 (weak-model tool-loop harness — dedup guard + early force-answer + per-model budget) · SEED-119 (citation footer = retrieval superset of inline markers → make cited-vs-retrieved legible). **Advisory (non-blocking, in `153-SECURITY.md`):** MD-01 Open-doc dead-end (fail-safe UX), LW-02 `_strip_citation_note` literal-sentinel spoof (RLS-scoped self-inflicted). **Cross-provider breadth (OpenAI/Google/OpenRouter) + full-doc-peek/parallel-thread/long-message axes recommended for a future live spot-check (all unit-covered).** **Next: Phase 154 (Plain-Language Layer, LANG-01) — G-2 sketch not required (label layer); `/gsd:discuss-phase 154`.**

**Phase 123 — Skill Triggering Quality (TRIG-01 / TRIG-03 / CTX-03) — COMPLETE (2026-06-26).** All 3 gates clear: secure-phase 29/29 threats CLOSED (threats_open 0, `fc17016b`) · validate-phase NYQUIST-COMPLIANT 12/12 Per-Task COVERED (148 backend + 40 frontend = 188 tests green, `06ae19dc`) · verify 12/12 must-haves + **SC#10 4-axis live UAT 4/4 PASS** (2026-06-26): Axis 1 cross-provider D-01 fidelity · Axis 2 multi-tool pin durability (surfaced+fixed render bugs BUG-260626-01/-04 — shared `dedupMessagesByRunId` helper, `2a48fea4`/`6ec8be77`, verified live) · Axis 3 parallel-thread isolation (3-run Redis snapshot, no pin leak) · Axis 4 long-message pin + honest `_TRIM_MARKER` eviction (forced real 8000-tok overflow). `123-VERIFICATION.md` flipped `human_needed` → `passed`; `123-HUMAN-UAT.md` status passed (4/4). **Deferred (NOT 123 blockers):** BUG-260626-02 (Phase-120 baseline leak into live final-emit) + BUG-260626-03 (run-end todo finalizer) → **SEED-094** (backend run-end honesty). Follow-up candidate: LangSmith not emitting since 2026-06-20 (raw-SDK `wrap_openai` path). **Next: Phase 124 (Workflow Studio UX) — G-2 sketch-gated; run `/gsd:sketch 124`.**

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

Items acknowledged and deferred at the **v3.2 milestone close on 2026-07-10** (47 total from the pre-close `audit-open` sweep). Triaged: none are v3.2 CORE blockers — the CORE Skill Eval Studio (132-137 + inserts 137.1/137.2) shipped complete; the open items are intentional forward seeds, stale pre-GSD tracker cruft, and live-UAT / verification status-lag on delivered STRETCH phases.

| Category | Count | Disposition |
|----------|-------|-------------|
| Unimplemented seeds | 9 | Deferred-by-design with re-open triggers (incl. SEED-108 RAG↔file bridge, SEED-109 eval/tuner run-lifecycle migration, SEED-110 workflow run-time template upload, SEED-112 per-workflow KB folder-scope). Future-milestone candidates — the SEED-110/112 workflow-file cluster surfaces at the v3.3 sweep. |
| UAT gaps | 10 | Live-UAT status-lag on delivered phases: 140 (embed 429), 141 (cross-provider render smoke), 142 (held-partial), 143 (non-operator A1 + empty-folder — core proven live 2026-07-10). Code shipped; verification debt only. |
| Verification gaps | 5 | `human_needed` bookkeeping never flipped to `passed` after the live UAT actually ran. No real pending work. |
| Quick tasks | 22 | Orphaned `[missing]` tracker slugs (Mar–Jun 2026) — already-fixed bugs from v2.5–v3.1. Tracking cruft, not v3.2 work. |
| Pending todos | 1 | Legacy spike todo — satisfied by shipped work. |

**FILE-01 (Phase 144, Agent-Driven Skill File Attachment)** — the one undelivered requirement; **deferred → v3.3** (gated STRETCH, not executed). Rolls forward with the workflow-file cluster (SEED-110 template upload, SEED-112 folder-scope).

**Open `surface: Agentic-RAG` reports (roll forward into the v3.3 UAT blast radius):** BUG-260609-02/-04, BUG-260610-01, BUG-260623-01, BUG-260706-01, BUG-260707-03, BUG-260708-01/-02, BUG-260710-01/-02 (nav/display + provider-polish), plus the deferred agent-loop / todo-loop notes. Cross-check at `/gsd:discuss-phase` per the reported-bugs mandate.

## Roadmap shape (v3.4, created 2026-07-18)

Numbering continues from v3.3's last phase (159) → **CORE Phases 160-168**, then **STRETCH Phases 169-173** (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 / v3.3 156-159 precedent). Migrations continue from live head → **next free slot = 104**. Scope source: `.planning/REQUIREMENTS.md` (22 CORE + 7 STRETCH = 29 reqs). Research: `.planning/research/SUMMARY.md` (re-authored against live schema head 103).

**CORE (committed) — Phases 160-168:**

| Phase | Name | REQ-IDs | SC# | Flags |
|---|---|---|---|---|
| 160 | Tenancy-Model ADR | ADR-01 | 3 | ratify-not-relitigate; no code; no threat model; skip research |
| 161 | Org / Dept / Role Schema | ORG-01, ORG-02 | 4 | **threat model** (isolation cluster; `current_user_org_ids()` breaks 42P17); additive/zero-behavior; skip research |
| 162 | Personal-Org Backfill | MIG-01 | 4 | **threat model** (lock-storm/idempotency/NOT-NULL-order/`is_global` data-loss) |
| 163 | RLS Rewrite + User-JWT Client Swap — **ATOMIC CRUX** | TEN-01, TEN-02, TEN-04 | 5 | **SC#10**; **threat model (security core)**; **G-5/G-1** (`threads.py` extraction = Wave 0); **perf gate** (CONCUR-01 <1s); **research-phase** (live 2-user SET LOCAL/SET ROLE leak test) |
| 164 | SECDEF Audit + Cross-Org Isolation Suite | TEN-03, TEN-05, TEN-06, PRAG-01 | 4 | **SC#10**; **threat model (security core)**; **research-phase** (pgvector+RLS); folds SEED-091; TEN-05 = exit gate |
| 165 | `is_global` Retirement Cleanup | MIG-02 | 3 | threat model (lighter — `is_system_global` migration-only); mechanical; skip research |
| 166 | Org-Admin Shell + Switcher + Profile + Audit + Settings Split | ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05 | 5 | **SC#10** (UI state); **G-2 sketch** (SEED-113); **G-5** (`StreamsProvider.tsx`); threat model (X-Org-Id/audit authz); UI hint |
| 167 | Invitations + Roles + Greenlists + JIT + Per-User Prefs | INV-01, INV-02, VIS-01, VIS-02 | 4 | **SC#10** (VIS-02 = provider routing; greenlist UI state); **threat model** (token/JIT race); G-2 sketch (if visual); UI hint |
| 168 | SSO — SAML 2.0 (CORE) | SSO-01 | 3 | **threat model** (Supabase owns SAML parse; enforcement-before-fallback); UI hint; 0 new deps |

**STRETCH (gated behind CORE) — Phases 169-173:**

| Phase | Name | REQ-IDs | SC# | Depends |
|---|---|---|---|---|
| 169 | Dept-Admin Shell | ADMIN-06 | 2 | 166+167; G-2 sketch; UI hint |
| 170 | Commercial Footholds — Entitlements + Retention/Rate-Limit Data Layer | ENT-01, ENT-02 | 2 | 161+166; UI hint; footholds only (no enforcement/billing) |
| 171 | Permission-Aware Citations | PRAG-02 | 2 | 164+167; **research-gated** (CITE-01 + pgvector+RLS bench); SC#10; G-5 (`retrieval_service.py`+citation renderer); UI hint |
| 172 | OIDC Enterprise SSO | SSO-02 | 2 | 168; threat model (discovery SSRF); Authlib (scope-gated dep); UI hint; customer-triggered |
| 173 | Dept-Targeted Skills + Group Feature-Rollout Gating | VIS-03, VIS-04 | 2 | 165+167; UI hint |

- **Coverage:** 29/29 requirements mapped (22 CORE + 7 STRETCH); 0 unmapped, 0 duplicates. Every requirement → exactly one phase.
- **The atomic crux (LOCKED):** TEN-01 + TEN-02 + TEN-04 in ONE phase (163) — RLS is inert while the service-role / asyncpg-owner connection bypasses it. Never "policies now, client later." `SET LOCAL ROLE authenticated` (not the claims) is what turns RLS on.
- **`threads.py` extraction-first (G-5/G-1):** sequenced as **Wave 0 of Phase 163** before `org_id` threads through `send_message`; MAY be promoted to a dedicated refactor phase at discuss/plan-time (operator's call — if promoted, crux → 163.1 and STRETCH renumbers). Prior 147/149 in-place guard overrides logged below; this milestone pays the extraction down.
- **Data-dependency order (forced):** ADR → schema → backfill → crux → SECDEF+isolation-suite → is_global retirement → org-admin UI → invitations/roles/greenlists → SSO last (SSO has zero downstream dependents = first-to-cut).
- **SC#10 (cross-provider mandate):** 163 (crux — shared retrieval/agent-loop path), 164 (SECDEF/permission-aware retrieval), 166 (org-switcher/`<OrgContext>` UI state), 167 (VIS-02 model-default provider routing) + STRETCH 171. Pure-schema/ADR phases (160/161/162/165) deliberately NOT flagged.
- **Milestone exit gate:** the two-org `test_v3_4_org_isolation.py` suite (built in 164) is re-run AFTER 166/167/168 land, PLUS a final full-regression pass (SC#10 4-axis + CONCUR-01) — not only after the SECDEF phase.
- **G-2 sketch-gated:** 166 (org-admin shell/switcher/profile anchor — SEED-113), 167 (greenlist/roster UI if visual), 169 (dept-admin shell). `/gsd:sketch` before spec/discuss.
- **G-5 hot files:** `threads.py` (163 — extraction-first), `StreamsProvider.tsx` (166 — `<OrgContext>` OUTSIDE it, keep 067.5 Branch-D3 clear guard), `retrieval_service.py`+citation renderer (STRETCH 171).
- **Perf gate:** TEN-04 (163) `document_chunks`/`skill_embeddings` `org_id` denormalize+index must keep CONCUR-01 <1s green — benchmark before merge.
- **Research flags:** 163 crux (live 2-user leak test — do not ship on docs alone), STRETCH 171 (pgvector+RLS latency/recall bench), personal-org/JIT seam 162/167 boundary (trigger vs app-layer vs both). Skip: 160/161/165/166.
- **Threat models (secure-phase):** the isolation cluster 161-164 (security core), 165 (lighter), 166 (X-Org-Id/audit authz), 167 (token/JIT), 168 (SSO), + STRETCH 171/172. ADR 160 = no code.
- **Red line (D-14):** Deep Mode byte-identical; provider differences at the gateway/adapter boundary; no new runtime. KEEP the ~253 `.eq("user_id")` filters this milestone (belt-and-suspenders under the user-JWT client).
- **Reported-bugs:** chat-surface backlog stays OUT (post-v3.3 chat-polish phase); only SEED-091 folds here (TEN-06 → 164). Cross-check at each `/gsd:discuss-phase`.
- **Cloud parity owed:** v3.3 migrations 099-103 + `SECRETS_ENCRYPTION_KEY` still owed at next production push; v3.4 migrations start at slot 104.

Roadmap detail: `.planning/ROADMAP.md` (active v3.4 section). Requirements + traceability: `.planning/REQUIREMENTS.md`. Research base: `.planning/research/SUMMARY.md`.

## Roadmap shape (v3.3, created 2026-07-10)

Numbering continues from v3.2's last phase (145) → **CORE Phases 146-155**, then **STRETCH Phases 156-158** (gated behind CORE — ship only if CORE lands clean; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 precedent). **Phase 144 is BURNED** (held the deferred v3.2 FILE-01 phase, never executed, archived to `.planning/milestones/v3.2-phases/`; FILE-01 gets a fresh number — Phase 151). 144/145 are never reused. Scope source: `.planning/REQUIREMENTS.md` (19 reqs — 16 CORE + 3 STRETCH). Research: `.planning/research/SUMMARY.md`.

**CORE (committed) — Phases 146-155:**

| Phase | Name | REQ-IDs | SC# | Flags |
|---|---|---|---|---|
| 146 | Operator Foundation | ADMIN-01 | 4 | **G-2 sketch**; threat model (service-role / no-RLS-backstop, default-deny 404); one-way-door `operator_users` schema; `org_id` stubs; UI hint |
| 147 | Operator Control Plane | ADMIN-02, FLAG-01 | 4 | **SC#10** (active-runs + Kill); **G-2 sketch**; fail-closed kill-switches; UI hint |
| 148 | Governance — Audit, Users & Feature Visibility | ADMIN-03, VIS-01 | 4 | threat model (cross-user reads); **G-2 sketch**; VIS-01 API-enforced; impersonation → STRETCH/named-trigger; UI hint |
| 149 | Model Registry & Discovery | MODEL-01, MODEL-02 | 4 | **SC#10**; **G-2 sketch**; propose-not-auto-enable; read path already live (mig 053); UI hint |
| 150 | Secrets at Rest | SEC-01 | 4 | threat model (secrets); app-layer `cryptography` (NOT pgsodium); env-fallback preserved; round-trip-verified |
| 151 | Agent File Tools | FILE-02, FILE-01 | 4 | **SC#10** (new agent tools); threat model FILE-01 (WRITE) + FILE-02 (RAG→sandbox); order FILE-02→FILE-01 |
| 152 | Workflow Run Inputs | WFIN-01, WFIN-02, WFIN-03 | 3 | **SC#10**; **G-2 sketch** (Run modal); threat model WFIN-01 (upload/SSTI); SEED-112 scope-shape = discuss/sketch; UI hint |
| 153 | Inline Citations | CITE-01 | 4 | **G-2 sketch** (mandatory); **G-5** (`MessageItem.tsx`/`StreamsProvider.tsx`); **SC#10**; Pitfall 14 (set-membership); UI hint |
| 154 | Plain-Language Layer | LANG-01 | 3 | Pitfall 15 (no enum/API/audit break; Deep byte-identical); extends Phase-124 two-door; UI hint |
| 155 | Accessibility Sweep — WCAG AA | A11Y-01 | 3 | LAST (audits all net-new surfaces); new dev deps `@axe-core/playwright` + `eslint-plugin-jsx-a11y`; UI hint |

**STRETCH (gated behind CORE) — Phases 156-158:**

| Phase | Name | REQ-IDs | SC# | Depends |
|---|---|---|---|---|
| 156 | Everyday UX Polish | POLISH-01 | 3 | — (SEED-045 anchors; gated on CORE); UI hint |
| 157 | Deployment Presets & Runbook | DEPLOY-01 | 3 | — (docs/config; gated on CORE) |
| 158 | First-Run Install Wizard | DEPLOY-02 | 3 | 157 (uses presets); biggest lift → first to cut; UI hint |

- **Coverage:** 19/19 requirements mapped (16 CORE + 3 STRETCH); 0 unmapped. Every requirement → exactly one phase.
- **Sequencing rationale:** Operator foundation FIRST (146 — ADMIN-01 keystone; locks the v3.4 one-way-door role schema). Model registry + discovery early (149 — highest ROI, read path live since mig 053); secrets-at-rest (150) as the separable Track-3 security sub-phase. Workflow file cluster with internal order FILE-02 (read) → FILE-01 (write, reference threat pattern) in 151, then WFIN-01+WFIN-02 together on the shared run-input channel + WFIN-03 (safe delete) in 152. UX track last: CITE-01 (153, largest lift, G-5 hot files, G-2 sketch), LANG-01 (154, app-wide relabel), A11Y-01 (155, audits everything last).
- **SC#10 (cross-provider mandate):** 147 (active-runs/Kill), 149 (model-registry UI state → provider routing), 151 (two new agent tools), 152 (run-input channel + folder scope), 153 (inline citations).
- **UI hint:** 146, 147, 148, 149, 152, 153, 154, 155 (CORE) + 156, 158 (STRETCH).
- **G-2 sketch-gated:** 146, 147, 148, 149, 152, 153 (+ 156 if visual). `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`.
- **Threat models (new WRITE/upload surfaces):** FILE-01 + FILE-02 (151), WFIN-01 (152); plus the standing admin-isolation threat model on 146/148 (service-role, no RLS backstop).
- **G-5 hot files:** `MessageItem.tsx` + `StreamsProvider.tsx` (153 inline citations — do NOT regress the shared render path); `threads.py` stays untouched (new agent tools register in the flat `_TOOL_REGISTRY`).
- **Red line:** never fork the shared path — provider differences at the gateway/adapter/sanitizer boundary (D-14). Deep Mode byte-identical; no new runtime.
- **Reported-bugs:** 10 open `surface: Agentic-RAG` reports roll into the v3.3 UAT blast radius; cross-check at each `/gsd:discuss-phase`. v3.2 verification debt (140/141/142/143) must not regress.

Roadmap detail: `.planning/ROADMAP.md` (active v3.3 section). Requirements + traceability: `.planning/REQUIREMENTS.md`. Research base: `.planning/research/SUMMARY.md`.

## Roadmap shape (v3.2, created 2026-06-28)

**CORE (committed) — Phases 132-137:**

| Phase | Name | REQ-IDs | SC# | Flags |
|---|---|---|---|---|
| 132 | Skill Versioning + Eval Test-Case Persistence | VER-01, EVAL-01 | 4 | Schema/RLS foundation (~5 new tables); owner-scoped (skills precedent); no agent-loop/provider touch |
| 133 | Eval Runner — With-Skill vs Without-Skill | EVAL-02 | 4 | SC#10; G-5 (net-new eval router — do NOT grow `threads.py`; consume `agent_loop.py`/gateway read-only); no new runtime |
| 134 | Eval Results, Honest Verdict + Ratings | EVAL-03, EVAL-04 | 4 | SC#10 (per-provider verdict honesty, MP-03 precedent); UI hint (polished panel = 137) |
| 135 | Self-Improvement Loop (SI-01) | SI-01 | 4 | SC#10; UI hint (diff review); human-in-the-loop; G-5 (consume agent_loop/gateway read-only) |
| 136 | Skill Publish Gate (GATE-01) | GATE-01 | 3 | UI hint (publish-flow gate); future-publish-only |
| 137 | Skill Evals Panel UI (PANEL-01) | PANEL-01 | 4 | **G-2 sketch**; UI hint; SC#10 (UI state); additive (no Skills-tab redesign) |

**STRETCH (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 precedent) — Phases 138-144:**

| Phase | Name | REQ-IDs | SC# | Depends |
|---|---|---|---|---|
| 138 | Run-End Honesty | RUN-01 | 3 | — (backend-only, small, can go early); G-5 (`agent_loop.py` finalizer); SEED-094 |
| 139 | Self-Improve Proposer (description-only) | SI-02 | 3 | 135 |
| 140 | Smart-Dispatch Relevance Pre-Filter | TRIG-02 | 3 | 123 (shipped); G-5 (catalog injection); SC#10 |
| 141 | template_input Resolver Run-Scope | COLL-02 | 2 | 120 (shipped) |
| 142 | Non-Python Skill-Script Honesty | SRH-01 | 3 | 120 (off COLL-01 seam, shipped); DISC-01 Layer 1 |
| 143 | Starter Workflow Library | WF-01 | 3 | — (Workflows page exists); SEED-084; UI hint |
| 144 (added 2026-07-05) | Agent-Driven Skill File Attachment | FILE-01 | 4 | — (no hard dependency; `skill_files` table/bucket already exist); new WRITE-capable tool — needs its own threat model + SC#10 proof; SEED-104 (promoted from Phase 137.2's live SC#4 UAT) |

- **Coverage:** 15/15 requirements mapped (8 CORE + 7 STRETCH); 0 unmapped. Every requirement → exactly one phase.
- **Sequencing rationale:** VER-01 paired WITH EVAL-01 in the foundation (132) — test cases reference an immutable skill version. Strict eval chain 132 → 133 → 134 (persistence → runner → results). SI-01 (135) needs the full eval substrate (EVAL-02 + EVAL-03 + VER-01 + EVAL-04 ratings). GATE-01 (136) consumes the pass/fail verdict. PANEL-01 (137) lands LAST as the sketch-gated consolidation of the whole eval experience (depends EVAL-01..04 + VER-01). RUN-01 (138) is backend-only/small — the safest STRETCH to pull forward; it closes SEED-094.
- **SC#10 (cross-provider mandate):** flagged on every phase touching streaming / agent loop / provider routing / UI state — headline three EVAL-02 (133), SI-01 (135), TRIG-02 (140), plus per-provider-display / UI-state phases 134, 137, 139.
- **UI hint:** 134, 135, 136, 137 (CORE) + 139, 143 (STRETCH).
- **G-2 sketch-gated:** 137 (PANEL-01). `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`.
- **G-5 hot files (audit at discuss-phase):** `backend/app/api/threads.py` (firing → extraction STILL due — do NOT grow it; eval runner 133 + SI-01 135 = net-new routers, `skill_tuner.py` precedent), `backend/app/services/agent_loop.py` (RUN-01 138 finalizer/terminal; TRIG-02 140 catalog-injection; 133/135 consume read-only), catalog injection + `context_window.py` token budget (140).
- **Red line:** never fork the shared path — provider differences at the gateway/adapter/sanitizer boundary (D-14). Deep Mode byte-identical; no new eval runtime (evals reuse the agent loop + provider gateway).
- **Reported-bugs:** RUN-01 (138) closes SEED-094 (BUG-260626-02 baseline leak into final-emit + BUG-260626-03 run-end todo finalizer).

Roadmap detail: `.planning/ROADMAP.md` (active v3.2 section). Requirements + traceability: `.planning/REQUIREMENTS.md`. Scope source: `.planning/PRDs/v3.1-skill-studio-eval.md`.

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

- **Phase 144 added (2026-07-05):** Agent-Driven Skill File Attachment (FILE-01) — new `attach_skill_file` tool + endpoint so the agent can attach files/scripts/assets it creates during skill authoring, and a user can hand the agent an existing template file mid-conversation for the agent to attach; reuses the existing `skill_files` table/bucket, no new storage surface. Promoted from SEED-104 (planted during Phase 137.2's live SC#4 UAT, deliberately deferred there to avoid a 3rd decimal insert onto the 137.x chain mid-verification). Appended to the end of v3.2 STRETCH (after Phase 143); needs its own threat model at discuss-phase (net-new WRITE-capable tool) + SC#10 cross-provider proof.
- **Phase 111.1 INSERTED after Phase 111 (2026-06-15):** "Configurable / Multi-Provider Embeddings (incl. local Ollama + LM Studio)" — embedding-provider picker + local presets + re-embed-on-change lifecycle; new reqs **EMBED-01..06**; depends on Phase 111 (reuses its `lmstudio` provider plumbing); G-2 sketch fires (Settings UI). Lands before the DM read-path phases (113-119). Sourced from a 5-agent investigation (the `embedding-flexibility-scoping` workflow). **Decision:** keep embedding flexibility OUT of Phase 111 (different domain = retrieval substrate, not the metadata LLM; plus the fixed-`vector(1536)`/HNSW dimension + destructive-re-embed landmine) → its own phase. **Retires SEED-048.** **SEED-048 correction:** embeddings are NOT OpenAI-hardwired today — `embedding_model`/`embedding_base_url`/`embedding_api_key`/`embedding_dimensions` are already configurable Settings with UI controls (`SettingsPage.tsx:934-950`); what's missing = a provider picker, local presets, the re-embed lifecycle, and a fix for the `embed_chunks` `user_settings`-drop bug (folded in as EMBED-04). The 111.1 plan must VERIFY these findings against live code.

**Open blockers:** None. (Resolved 2026-06-08: Phase 097 Plan 01 Task 3 human-action checkpoint — operator confirmed folder `75755ec9-5ba7-495b-ad93-7500011cf6f2` "Project Meridian — Risks" and ingested a synthetic risk corpus to ground it; `out/spike-config.json` written + committed `61025148`.)

**Key decisions** (full log in PROJECT.md → Key Decisions): D-v2.8-01 (harness now; Plugin Contract was deferred to v2.9 — **now reframed**: Plugin Contract OFF the v2.9 critical path, value-first Workflow Studio instead, lock `phase_type`+`file_preview` on flagship telemetry as STRETCH Phase 108), GATEWAY-01 (one shared provider gateway, Deep byte-identical — workflows consume it, never re-implement), D-094-UNIFY (panel = single live-execution surface for Deep + Harness), D-095.1 (run honesty = projection/classification over existing data; provider handling at the gateway boundary). New v2.9 design anchors from research: "project = folder" as the single scope object; immutability = "no-edit-published" not "no-grow-format" (additive optional fields keep old workflows validating); LLM produces DATA, deterministic code produces the FILE; output-quality judge gate is a HARD publish blocker. **Spike 097 Plan 04 (unknown d, 2026-06-09):** describe→refine→publish feel = **MIXED** — the authoring mechanism works (grounded one-shot generation + conversational refine over the strict schema yields correctly-typed, schema-valid drafts) but Phase 103 (WFAUTH-02) MUST add (1) a clarify-as-you-go **grey-area validation loop** — surface every ambiguity (unresolvable folder ref / vague scope / unmapped placeholder / missing tool+skill) for explicit user validation, NO silent substitution (the spike caught the generator silently mapping a non-existent "Acme" folder and a non-existent "/Risks subfolder") — and (2) a **tweak→new-version** authoring path (editability = a versioning op; immutability is per-version, not per-workflow — confirms the "no-edit-published" anchor). Unknown (c): folder tree + tool names + template placeholders are MUST-HAVE authoring grounding; skill registry nice-to-have; PROJ-02 bound `folder_scope`/`project_folder_id` confirmed needed (scope leaked into prompt text for lack of a schema field).

**Deferred items carried from v2.8 close (2026-06-07):** 43 acknowledged items — full inventory in `.planning/milestones/v2.8-MILESTONE-AUDIT.md` (and the prior STATE.md in git history). Headline: CONC-01 partial → SEED-065-B (cross-tab GET p95 ~3 s residual); PARITY-01 re-deferred; 11 dormant forward seeds (SEED-002/003/004/005/040/041/042/043/044/045/046); SEED-048/050/057 carried/active.

**Planned Phase:** 112 (metadata-enrichment-document-detail-panel-manual-edit) — 4 plans — 2026-06-17T20:46:10.826Z

- Phase 123.1 inserted after Phase 123: Trigger Tuner design fidelity + UX polish (post-live-UAT gaps) (URGENT)

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
| Phase 120 P03 | ~10min | 3 tasks | 2 files |
| Phase 121 P01 | 6min | 2 tasks | 2 files |
| Phase 121 P02 | ~12min | 2 tasks | 3 files |
| Phase 122 P01 | 29min | 2 tasks | 4 files |
| Phase 122 P04 | 5min | 2 tasks | 4 files |
| Phase 122 P02 | ~13min | 2 tasks (TDD) tasks | 3 files files |
| Phase 122 P03 | ~6min | 2 tasks | 3 files |
| Phase 123 P01 | 9min | 2 tasks | 8 files |
| Phase 123 P02 | 7min | 2 tasks | 3 files |
| Phase 123 P03 | 12min | 2 tasks | 6 files |
| Phase 123 P04 | 8min | 2 tasks | 3 files |
| Phase 123 P05 | ~10min | 3 tasks (2 TDD) | 11 files |
| Phase 123 P06 | ~30min | 2 tasks | 8 files |
| Phase 123.1 P01 | ~20min | 3 tasks | 6 files |
| Phase 123.1 P02 | 5min | 2 tasks | 4 files |
| Phase 123.1 P03 | ~12min | 1 task (TDD) | 2 files |
| Phase 123.1 P04 | 18min | 2 tasks | 4 files |
| Phase 123.1 P05 | 11min | 4 tasks | 7 files |
| Phase 123.1 P10 P10 | ~1min | 1 tasks | 2 files |
| Phase 123.1 P06 | 7min | 2 tasks | 3 files |
| Phase 123.1 P07 | ~12min | 2 tasks | 4 files |
| Phase 123.1 P08 | ~10min | 2 tasks | 6 files |
| Phase 123.1 P09 | ~6min | 1 tasks | 2 files |
| Phase 132 P03 | ~30min | 3 tasks (1 human-verify gate) | 4 files |
| Phase 138 P138-04 | 5min | 2 tasks | 2 files |
| Phase 142 P04 | ~5min | 2 tasks | 2 files |
| Phase 142 P02 | 8min | 3 tasks | 4 files |
| Phase 142 P03 | 5min | 3 tasks | 3 files |
| Phase 143 P02 | 9min | 2 tasks | 2 files |
| Phase 143 P03 | 6min | 3 tasks | 4 files |
| Phase 143 P04 | 6min | 2 tasks | 3 files |
| Phase 146 P01 | 9min | 3 tasks | 3 files |
| Phase 146 P02 | 11min | 3 tasks | 8 files |
| Phase 146 P146-04 | 2min | 2 tasks | 3 files |
| Phase 146 P05 | 3min | 3 tasks | 5 files |
| Phase 146 P06 | 10min | 3 tasks | 6 files |
| Phase 148 P01 | 40 | 3 tasks | 15 files |
| Phase 148 P03 | ~6min | 1 auto task (Task 1 = operator human-action) | 1 file |
| Phase 149 P09 | 7min | 2 tasks | 7 files |
| Phase 149 P11 | 18min | 2 tasks | 2 files |
| Phase 149 P12 | 12min | 1 tasks | 2 files |
| Phase 150 P02 | 2 | 2 tasks | 2 files |
| Phase 159 P01 | 13 | 2 tasks | 3 files |
| Phase 159 P06 | 12min | 3 tasks | 4 files |

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
- [Phase 120]: Phase 120-03 (CTX-01): migration 076 APPLIED to the live DB (:54322) via psycopg2-direct (NOT db push/reset) — messages.origin NOT NULL DEFAULT 'deep'::text + messages_origin_check CHECK (origin IN ('deep','harness')) confirmed live; 658 legacy rows backfilled to 'deep', zero NULL (the load-bearing NULL-trap guard closed). full-schema.sql regenerated via scripts/regenerate-full-schema.sh (no --reset) — contains origin column at lines 615-616. Full Phase 120 test set green 21/21 (3 integration + 4 collision-regression + 14 origin-filter); the two prior PGRST204 test_093 failures (test_deep_runs_id_path_still_200, test_ask_user_answer_resolves_via_workflow_run_fallback) RESOLVED by the apply. The 3 test_sandbox_service TestHarvestOutputFiles failures are PRE-EXISTING (Phase 075.4 hash-keyed signature pivot, deferred-items.md), 0 net-new.
- [Phase 120]: Phase 120-03 (CTX-01) Rule 1 fix: the live-DB origin CHECK probe (test_120_migration.py) omitted the NOT NULL user_id column, so the INSERT failed on user_id BEFORE the origin CHECK was reached — a VACUOUS probe. Reuse the throwaway auth.users id for FK + NOT NULL so the CHECK genuinely accepts deep/harness and rejects 'other'. Lesson: live-DB constraint probes must satisfy every NOT NULL sibling column or the target CHECK is never evaluated (commit 035295a1).
- [Phase 121]: Phase 121-01 (IA-01): removed the Deep/Harness composer toggle + in-chat workflow picker → 2-pill composer (Model + General/Explorer); composer-stop is the post-removal Cancel (D-01, no new chrome); kickoffWorkflowId staging deleted as dead code but postMessage/doRun launch route untouched (SC#2/D-02); workflowLocked gating + mount reconcile + 409 banner preserved byte-identical (SC#3); tsc clean, no backend/migration (D-06/G-5).
- [Phase 121]: Phase 121-02 (IA-01): SC oracles bound as isolated test-only assertions — SC#1 2-pill (workflow-mode-selector + workflow-picker null, agent-mode + Model present), Cancel-reachability D-01 (composer-stop click → onStop), SC#3 (workflowLocked disable + 'Workflow running — Cancel to switch back' placeholder; getThreadWorkflow locked:true mount-reconcile disables; 409 test b byte-unchanged), SC#2 (ChatLayout doRun → createThread + postMessage{workflowDefinitionId} + onNavigate('chat')); RunCard tests untouched + GREEN
- [Phase ?]: Phase 121-02 (IA-01): reset workflowLockByThread in ChatAreaBanner beforeEach (Rule 1 test-isolation — the lock map is not mock-cleared so a locked reconcile bled into the next test); reconcile-lock mocks use mockResolvedValue not …Once because the mount reconcile effect can re-fire
- [Phase 122]: 122-01 (MP-02): emit_tier Literal[force_strict|force|coerce] is the single source of truth on every MODEL_CAPABILITIES row (D-122-04); 55 rows migrated 14/36/5; 2 DeepSeek DEMOTED to force (strict inert without /beta base_url, Pitfall 3); registry miss -> coerce (default-SAFE D-122-05). Old bools kept deprecated-unread for 1-phase rollback (no derived view re-reading strict_json_schema).
- [Phase 122]: 122-01 (MP-02): removed the hardcoded 'and provider == openai' strict gate (now tier-driven: json_schema response_format requested whenever strict_response_format is true) + the inert function-level DeepSeek strict loop in openai_service.py forcing branch; A4 preserved (OpenAI force_strict still emits json_schema response_format). Pitfall 5 seams (deepseek thinking-off, 111.1 local-provider) untouched; removed now-dead import copy (Rule 3).
- [Phase ?]: Phase 122-04 (TDP-01): TDP-01 is a PROMPT problem not a schema problem — the execute_code.description schema field (openai_service.py:601-603) is already strong; the fix is ONE ungated provider-agnostic nudge bullet in the shared SYSTEM_PROMPT (D-122-08, SC#4), one additive string no logic in G-5 hot file agent_loop.py, pinned by a string-presence guard.
- [Phase ?]: Phase 122-04 (TDP-01): NO Anthropic-specific extraction added — BUG-260528-03's stated cause is WRONG; tool_args_progress is already cross-provider in all 3 adapters, so the ungated SHARED-prompt nudge is the correct provider-agnostic lever (red line D-14 held, no shared-path fork).
- [Phase ?]: Phase 122-04 (TDP-01): exported humanize() (one word, no behavior change) to assert the bare-name floor (?? name) directly — no MEANINGFUL_TOOLS member is also absent from PRETTY_TOOL_NAMES (only execute_code, which has its own branch), so deriveWorkspacePanel() alone cannot exercise the floor; PRETTY_TOOL_NAMES NOT pre-emptively extended (D-122-08 — only if SC#10 UAT surfaces a bare name).
- [Phase 122]: 122-02 (MP-01): the force-coerce ladder lives IN forced_emit as a tier-scoped rung loop over _RUNGS_BY_TIER (force_strict→[strict_force,non_strict_force,coerce], force→[non_strict_force,coerce], coerce→[coerce]); a strict-400/truncation/no-emit DESCENDS to the next rung (continue) instead of short-circuiting to None (BUG-260615-01); all 4 consumers inherit it unchanged.
- [Phase 122]: 122-02 (MP-01): emit_rung telemetry added to the success dict + identifier-only logger.info; the ladder NEVER mutates the registry (D-122-03, runtime auto-demotion rejected). The Phase-103 strict override is preserved by DEMOTING strict_force→non_strict_force when strict=False; honest-fail floor returns emit_rung=None + the last rung's failure reason. 111.1 :251-291 injection block untouched (Pitfall 5).
- [Phase ?]: Phase 122-03 (MP-03): --forced-emit matrix is a DIRECT-CALL harness (imports forced_emit, drives it per provider x EASY/HARD schema) NOT body.model — body.model does not steer harness phases (Pitfall 6); no bearer/DB/agent-run (never writes), localhost gate in main() suffices, T-122-03-03 SQL surface N/A
- [Phase ?]: Phase 122-03 (MP-03): HARD schema (optional-heavy + additionalProperties confidence object) is the strict-rung trip-wire (Pitfall 1) making the recovery axis non-vacuous; recovery=PASS on any ladder win, force=PASS only on the declared TOP rung, trigger=FAIL on provider_error but honest_fail still PASS; DOCUMENTED clears the gate (D-122-07); the operator grep-before-tier-flip ritual is the MP-03 gate (NOT CI, D-122-06)
- [Phase ?]: Phase 123-01 (TRIG-03/D-01): LOAD_SKILL_POLICY lives in skill_lint.py (not agent_loop.py) so the Plan 03 Tuner classifier imports ONE source of truth — Pitfall 1 fidelity guard. agent_loop catalog note relaxed to fire load_skill on description match, reconciled with LOAD_SKILL_TOOL; owner-scoped catalog query preserved byte-for-byte.
- [Phase ?]: Phase 123-01 (TRIG-03): lint_description is pure/never-raises/warn-never-block (D-09); wired into POST+PATCH /skills + agent save_skill via the existing owner-scoped .or_() sibling fetch (excludes edited skill on PATCH, degrades to [] on read failure). openai_service NOT modified — already D-01-aligned. ZERO migration/package. 11 test_threads_skills failures verified pre-existing.
- [Phase 123]: 123-02 (CTX-03): trim_messages_to_fit gains a THIRD protected class — pinned load_skill groups (_extract_pinned_skill_groups) kept like the protected tail, de-duped to latest per skill, capped at PIN_BUDGET_FRACTION=1/3 of max_tokens, LRU-evict lowest-index over budget + honest _TRIM_MARKER; no-pins fast path = byte-identical pre-CTX-03 (G-5). Single trim path, no fork (D-14 RED LINE).
- [Phase 123]: 123-02 (CTX-03): _reconstruct_history tags load_skill tool-results with _pinned_skill IN CODE (gated on tc.get('name')=='load_skill', skill name from args with tool_call_id fallback) — never sniffs the result JSON (D-13), never hoists to system prompt. _atomic_groups mirrors _remove_oldest_atomic so a pinned group keeps its assistant+tool_calls parent (Pitfall 2).
- [Phase ?]: Phase 123-03 (TRIG-01): resolve_skill_builder_model (D-08) mirrors resolve_authoring_model — explicit setting (local id verbatim) -> first forced_emission default -> honest None; no paid-provider SPOF, decoupled from benchmark targets; surfaced on config.py Settings + UserEffectiveSettings.
- [Phase ?]: Phase 123-03 (TRIG-01): skill_tuner_service is thin orchestration over forced_emit (no agent-loop/raw-SDK fork, D-14); build_candidates/classify_fires use FLAT single-typed schemas + non-empty system_prompt; classify_fires embeds the shared LOAD_SKILL_POLICY (Pitfall 1 fidelity); honest-fail -> [] / would_load=False.
- [Phase ?]: Phase 123-03 (TRIG-01): pure scoring = deterministic 60/40 split + 3-repeat aggregate + pick_winner BY HELD-OUT (never train); every cell carries BOTH fires/no_false (042-A). configured_targets = presence-only probe, OpenRouter distinct from native deepseek/zhipu, N=1 clean baseline, local first-class. auto_seed does no I/O; fetch_owner_scoped_siblings carries the .or_(user_id.eq,is_global.eq.true) leak gate. ZERO migration/package.
- [Phase ?]: Phase 123-04 (TRIG-01): net-new owner-scoped skill_tuner.py router (start/stream/results) over the Phase-061+ run-buffer; service-role + .or_(own,global) sole leak gate, 404 on cross-user; tuner_progress/tuner_provider_done/tuner_complete vocab never overloads chat events.
- [Phase ?]: Phase 123-04 (TRIG-01): background run bounded on every axis (MAX_CASES=40/MAX_TARGETS=8/MAX_ITERATIONS<=5 + per-call get_per_call_timeout + one job per skill via _INFLIGHT_SKILLS->409); calls ONLY Plan-03 forced_emit service fns (D-14 red line); cases+scoreboard ephemeral at tuner_result:{run_id} run-buffer key, no DB schema change.
- [Phase 132]: Phase 132-03 (EVAL-01/VER-01): thin SkillTestCasesSection mounted in SkillDetailPanel gated on savedSkillId — deliberately non-designed (--skip-ui scope fence; reuses Input/Textarea/Button, no tabs/panel chrome) so it does NOT pre-empt the Phase 137/PANEL-01/G-2 sketch-gated Evals panel. 4 wire-mirror TS types + 5 fetch-client funcs mirror the existing skill funcs (getAuthHeaders→fetch→typed cast); owner-scoping enforced server-side (Plan 02 .eq(user_id)). createTestCase seeds an empty row filled inline+Saved. Operator G-4 UAT verified: add/edit/delete persist across reload, version increments on instructions change but NOT on enabled/global toggle (D-02). Pre-existing tsc -b rot (29 errors, unchanged by this plan) deferred per SEED-056.
- [Phase 123]: Phase 123-05 (TRIG-01): Trigger Tuner React surface + the reachability triad in ONE plan (App ActiveView 'skill-tuner' + tunerSkillId + onTuneSkill, ChatLayout skill-tuner mount branch, SkillsPage 'Tune triggers' entry action on the selected skill) — the Phase-118 built-but-unreachable lesson; SkillTunerPage is a focused full-surface entered WITH a skillId (GovernancePage/publish-gauntlet ActiveView no-router precedent).
- [Phase 123]: Phase 123-05 (TRIG-01): ProviderScoreboard (no-analog, 042-A) derives its N columns PURELY from the server-returned cells — a provider the org doesn't run is simply absent so it never renders (a score you can't act on is fabricated); N=1 is the clean baseline (no degraded affordance), OpenRouter≠native zhipu/z-ai, EVERY cell shows BOTH fires (recall) + no-false (the false-fire rail), never a hidden aggregate (T-123-05-01).
- [Phase 123]: Phase 123-05 (TRIG-01): author-confirm-not-auto-apply (042-A/D-03) — CandidateCard's Use→reveal-diff is NOT the write; updateSkill (PATCH /skills, re-lints) fires ONLY on explicit confirm. LiveRunCard: queued≠running (no fake percent, 043-A) + never-vanishing elapsed timer derived from a stable start-ts (the 095 lesson, frozen on terminal) + reconcile-on-return (terminal 'done' re-reads GET results, SSE tuner_complete a best-effort hint per D-v2.5-03). CaseEditor 60/40 split bar mirrors backend split_held_out. ZERO package/migration; chat subscribeToRun untouched (purpose-built streamTunerRun tuner_* reader). 14/14 vitest, tsc clean.
- [Phase ?]: Phase 123-06 (TRIG-03/TRIG-01): inline never-block lint in the SHARED SkillForm under Description (covers modal + 3-pane); 'Tune this' reuses the verified Plan-05 onTuneSkill navigator (D-12); onSave widened to Promise<Skill|void> to capture lint_warnings.
- [Phase ?]: Phase 123-06 [Rule 3]: wired skill_builder_model through the /settings router (FullSettingsResponse + SettingsUpdate + handler) + api.ts — Plan 03 added the field+resolver but NOT the router surface; the picker spans cloud+local (no paid-provider SPOF, test-proven). ZERO migration/package.
- [Phase ?]: Phase 123.1-01 (D-07): tuner_runs durable latest-per-skill persistence — on_conflict=skill_id latest-wins upsert (UNIQUE(skill_id), one row/skill) in run_in_threadpool (D-v2.5-01), best-effort try/except ALONGSIDE the Redis stash; survives a Redis flush/refresh (closes BUG-260624-01 HIGH #3). user_id=last-runner attribution, NOT an access gate.
- [Phase ?]: Phase 123.1-01 (D-05/D-08): two owner-gated GET routes — /tuner/runs/latest (registered BEFORE /runs/{run_id} so the literal beats the UUID converter; 404 cross-user owner-OR-global; rehydration-on-open) + /tuner/cases/seeded (provenance seeded/sibling never 'held'; owner-scoped sibling leak gate intact). seed_cases_with_provenance is a NEW fn over the unchanged string-only auto_seed_cases (run path untouched). Frontend getTunerLatest 404->null + getSeededCases. ZERO new pkg; red line held.
- [Phase ?]: Phase 123.1-02 (D-02/D-12): ProviderScoreboard restored to sketch-041 vertical full-width rows (was a cramped grid, BUG-260624-01 HIGH #1); per-row magnitude bar + leading combined score from the server TunerCell.score (previously unused), both honest sub-scores kept visible; server-score-only; unchanged API so Plan 04 reuses it for the D-04 standalone block.
- [Phase ?]: Phase 123.1-02 (D-11): CandidateCard descriptions line-clamp-3 with a shared useState Show more/less toggle across the header AND both diff-confirm sides (diff-current/diff-new); held-out score + Use action are siblings (never clamped) so a ~1500-char description never buries them (BUG-260624-01 MED #5); CandidateCard tests split into CandidateCard.test.tsx.
- [Phase ?]: Phase 123.1-03 (D-09/D-10): Skill-builder picker now derives options from configured providers[].models across ALL providers (grouped as optgroups via PROVIDER_META labels w/ id fallback), replacing the hardcoded SKILL_BUILDER_MODEL_OPTIONS — strong models (Sonnet/Opus, GPT-pro) selectable. Auto value="" default kept pre-selected (NOT forced) + custom-persisted "(current)" branch guarded by a builderConfiguredModels Set (no duplicate row). IN-02 placeholder local ids (lm-studio/qwen3, openai-compat/local-model) removed — local models come from real providers. SOFT amber "unverified" hint mirrors the Active-Model chip via verified_models; NEVER hard-disables an option; A4 honored (no new forced_emission_models field, verified_models signal reused). Stored field/contract (app_settings.skill_builder_model) + resolver unchanged. No-SPOF footer rewritten to a provider-derived line. 7/7 vitest, tsc clean.
- [Phase 123.1]: Phase 123.1-04 (D-03/D-04/D-05/D-06/D-07/D-12): integration wave wired Plan-01 GET routes + Plan-02 ProviderScoreboard into SkillTunerPage. Mount reconcile-via-fetch effect: getSeededCases hydrates the editor with real seeded/sibling provenance (editable before run, startRun POST-body unchanged so edits run verbatim); getTunerLatest rehydrates the durable scoreboard on open (null/404 = graceful empty, no error); getSettings resolves the configured-target count (has_key && non-empty models, mirroring backend configured_targets). held tag RESOLVED by DROPPING it from the EditorCase union (split bar owns train/held-out). D-04 standalone block = scoreboard.candidates.find(c=>c.is_baseline) rendered via the Plan-02 component. Layout widened to 360px config rail + full-width results. previewModelCount precedence: in-flight targets -> persisted target_count -> live configured count. subscribeToRun untouched (WR-06 red line).
- [Phase ?]: Phase 123.1-05 (BUG-260624-01 #1): MAX_SEEDED_SHOULD_NOT=8 caps the sibling-sourced should_not inside auto_seed_cases (the SOLE place) so the run path + editor seed share ONE capped set (editor shows exactly what runs); a pure post-fetch slice of the already-owner-scoped fetch_owner_scoped_siblings output — never re-reads DB / never widens scope. Generic off-topic baseline ALWAYS kept in full.
- [Phase ?]: Phase 123.1-05 (D-honesty): GET /tuner/cases/seeded returns top-level total = uncapped sibling count (derived from len(sibling_descs), not the capped base); CaseEditor cap banner shows 'showing N of M — capped' ONLY when total > shown sibling-provenance count (never silent); 'show all N' is an honest disclosure, never fabricates the withheld cases.
- [Phase ?]: Phase 123.1-05 (sketch 045-B): pre-run layout = full-width single-column stack (description -> CaseEditor -> run bar) driven off existing runPhase + scoreboard (no new mode machine); editor stays mounted so author can re-edit + re-run; results render full-width below; ProviderScoreboard/LiveRunCard/CandidateCard reused untouched.
- [Phase 123.1]: 123.1-10 (TT-10): silenced the langsmith logger to ERROR at module scope next to the asyncio suppressor (scoped to langsmith only; ERROR-and-above still surfaces; tracing not disabled) + documented an optional commented-out LANGSMITH_TRACING_SAMPLING_RATE knob in .env.example (no Settings field — the client reads it from os.environ via load_dotenv)
- [Phase 123.1]: 123.1-06 (TT-05/12/15): tuner build_cell renders an empty axis as the unmeasured sentinel None (frontend 'n/a'), never a fabricated 1.0; an all-error column (every classify raised) is measured=False + EXCLUDED from the persisted target_count; cell_score returns the single stored cell['score'] verbatim (no recompute drift). _score_axis floor + held-out math + gateway untouched.
- [Phase ?]: Phase 123.1-07: TT-07 — _run_tuner_job emits stage='provider_start' (provider+model) at each column start via the tuner's OWN _emit_tuner (not the shared runs.py consumer); the frontend onProgress flips the matching lane queued->running on it
- [Phase ?]: Phase 123.1-07: TT-08 — DELETE cancel route is owner-verify THEN run<->skill bind (404 cross-user/foreign run_id, mirrors CR-01), sets a TTL'd tuner_cancel:{run_id} flag + releases the inflight claim; job checks the flag at candidate AND provider loop tops, skips winner/stash/durable upsert when cancelled, still runs its finally cleanup
- [Phase ?]: 123.1-08 (TT-12 render half): unmeasured tuner cell renders 'could not measure' from the server measured/null sentinel, never a fabricated 0.00 or 1.00 axis
- [Phase ?]: 123.1-08 (TT-16): reconnect-exhaustion keeps 'still running' ONLY when durable getTunerLatest.run_id === active run; a null/404 or previous-run row still hits the retained 'Lost connection' terminal (no stuck run)
- [Phase ?]: Phase 123.1-09: TT-11 — removed both decorative w-16 shrink-0 bg-sidebar rails (SkillsPage + SkillTunerPage); content keeps existing px-8 so it sits flush against the real NavPanel; real NavPanel (ChatLayout.tsx:289) untouched; tsc clean
- [Phase ?]: Phase 123.1-09: the SkillTunerPage rail survived the 123.1-05/07/08 restructure (relocated to lines 494-495) and was still present — removed here as the primary path, not the reconcile fallback the plan anticipated
- [Phase ?]: 138-04: TODOS panel reconciles LIVE on a clean run terminal via _reconcileTodosOnTerminal (fetch-on-terminal per D-v2.5-03); reuse-only, clean-completion-gated, best-effort, additive-only on G-5 StreamsProvider.tsx. Closes VERIFICATION must-have #5 code side; live UAT owned by 138-05.
- [Phase ?]: 143-02: owned_only additive default-off param on list_published_workflows (Published shelf narrows to mine; picker/WorkspacePanel/threads.py keep globals default — D-143-2b); Starters shelf = own list_starter_workflows curated-globals query + GET /workflows/starters
- [Phase ?]: Phase 143 Plan 03: 3 curated starters authored as seed migration 094 with DISTINCT slugs (pm-* would UNIQUE-collide); promote = TRANSFORM (strip folder binding+scope, re-home template to seed _library, category='starter', keep strict citation gates); storage bytes via scripts/seed-starters.py --upload
- [Phase ?]: Phase 143 scope-narrowing threaded as a 3rd positional options param on listPublishedWorkflows (not a 2nd-arg options object) so WorkspacePanel's signal-as-2nd-arg call stays byte-identical (D-143-2b)
- [Phase 146-01]: operator_users carries NO org_id (D-06 org-agnostic principal) — protects the v3.4 one-way door
- [Phase 146-01]: operator_audit_log.action is free-text with NO CHECK (A4); actor is PLAIN uuid NO FK (tamper-resistant, mig-059 idiom)
- [Phase 146-01]: org_id stubs on documents/folders/threads/skills with NO index — harness_audit shape per D-05, not the DM-era indexed shape
- [Phase ?]: Phase 146-02: require_operator is a ROUTER-level gate returning a byte-identical 404 on non-membership (non-discoverable, sole authority, no RLS backstop); old BACKPRESSURE_ADMIN_USER_IDS + dev fail-open deleted (D-02), OPERATOR_EMAILS replaces it.
- [Phase ?]: Phase 146-02: operator_audit_floor is a per-action yield-dependency (probe-EXEMPT) writing one append-only row per gated action; membership seam is asyncpg (patch _pg_pool in tests, not the supabase mock — Pitfall 6).
- [Phase ?]: 146-04: operator probe is render-only (getOperatorProbe 404→null); backend require_operator 404 gate stays the sole authority (Pitfall 13)
- [Phase 146]: 146-05: shipped the five Control Room presentational leaves (OperatorBand/HealthSignals/LockedTab/TechnicalNamesToggle/RecentActionsCard) — sketch winners 061-B + 062-A, pure prop-driven leaves typed against the Plan-04 api.ts contract, composed by the Plan-06 shell
- [Phase 146]: 146-05: LockedTab keeps NO phase-number token in shipped copy OR source comments (T-146-10 grep treats any 'phase 1xx' substring as a leak); amber operator zone uses Tailwind amber-* tokens (StatusPill precedent), not a bespoke warning utility
- [Phase 146]: Control Room reachable via the probe-gated shield rendered OUTSIDE NAV_ITEMS (D-07 byte-identity, regression-locked); the 061-B shell's manual ↻ Refresh honesty beat (no auto-poll) visibly prepends the operator's own 'Viewed system health' ledger row (D-04/D-08)
- [Phase ?]: 148-01: Nyquist Wave-0 scaffold — 14 RED test_148 files + banned_user/feature_visibility fixtures; wave-ownership split
- [Phase 148]: 148-04: governance_service.py cross-user reads (query_platform_audit, list_users_roster) swallow-and-log to [] (best-effort feed); only the CSV over-cap refusal (AuditExportTooLarge, >_CSV_MAX_ROWS=50000) propagates as a deliberate 4xx — never truncates. Every filter a NULL-guarded $N bind (user scope / action_type text[] ANY / half-open [since,until) window); page_size clamped <=100 at the service boundary (SC#4 no-full-tenant-leak).
- [Phase 148]: 148-04: export CSV returns the COUNT-probe value as the exact filtered count (not len(rows)) — the authoritative set size that gates the cap and 148-06 stamps onto audit.export; belt-and-suspenders LIMIT (==cap) never truncates a validated under-cap set. grant_operator idempotent ON CONFLICT DO UPDATE re-stamps granted_by; revoke_operator refuses self-revoke (409) BEFORE any pool access (Pitfall 7 lockout-proof).
- [Phase 148]: 148-04: skipped requirements.mark-complete for ADMIN-03 — service layer built + unit-tested (10/10 service tests GREEN) but not yet wired to any router (148-06 endpoints / 148-07 UI); marking now would be false-green. Completes at phase verify-work (mirrors 148-02 substrate posture). Controller-level tests (disable/enable/view_platform_recorded) stay expected-RED, owned by 148-06.
- [Phase 148]: 148-05 (VIS-01): require_visible attached at ROUTER level for the no-carve-out governed routers (evals.py both routers, skill_tuner.py, skill_test_cases.py, document_governance.py) so EVERY endpoint is gated safe-by-construction (require_operator precedent — a future endpoint cannot forget it); PER-ENDPOINT (decorator dependencies=[]) only on the carve-out routers settings.py (4 model_management gates) + workflows.py (6 workflow_authoring gates), because router-gating them would 403 the Run carve-outs (RESEARCH anti-pattern is scoped to exactly those two files). GET /settings/providers, GET /workflows/published|starters, and the threads.py workflow launch left ungated (Run stays for everyone — D-05); threads.py untouched.
- [Phase 148]: 148-05: skipped requirements.mark-complete for VIS-01 — the API enforcement WALL is done (GET /features + require_visible gates GREEN) but VIS-01's frontend hide/bounce half (148-07) is unshipped; marking now would be false-green. Completes at phase verify-work (mirrors the 148-02/148-04 substrate posture).
- [Phase 148]: 148-03 (VIS-01): operator applied migration 098 to the live LOCAL DB via the SQL editor (NEVER db push/reset — preserves dev data); full-schema.sql regenerated (no --reset, live-DB dump) — feature_visibility jsonb column captured at line 468, a 1-insertion dump delta not a hand-edit (commit edfcc1a0). CLOUD PARITY: mig 098 (column + D-05 seed UPDATE) MUST be pasted into the CLOUD Supabase SQL editor at the next promotion — local + cloud each carry their own app_settings.global row (docs/DEPLOYMENT-WORKFLOW.md §5 parity checklist + the standing v3.3 cloud-migrations rule; mirrors mig 097). Skipped requirements.mark-complete for VIS-01 (multi-plan feature; marked at phase verify-work — same posture as 148-02/04/05).
- [Phase 149]: 149-11: agent_loop pre-injection gate now fires for compat-path STRUCTURED (operator native_tools=False OVR) via _should_pre_inject_structured — warmed by get_model_capability_async before the sync resolve_calling_mode read; anthropic/google native-SDK excluded (WR-05); openrouter+xml and no-override paths byte-identical (D-14).
- [Phase 149]: 149-12: suggestion chips strip <think> reasoning blocks before the line-parse (module-private _strip_think_blocks mirrored from the threads.py sibling, not imported — avoids api->service inversion + G-5 hot-file import); strip runs BEFORE clamp-to-3 so reasoning never fills chip slots; closes round-2 UAT Test-7 minor gap on the D-149-10 fallback path.
- [Phase 159]: D-159-01 realized (159-01): UTILITY_MODEL_EXCLUDE is the single shared chat-filter constant; curate imports it; discovery new entries carry a display-only utility tag that never mutates the confirmable diff (SC#3).
- [Phase 159]: 159-06 (D-159-04): the discovery suitability filter is DISPLAY-only — `visibleNew`/`hiddenNewCount` feed the render only; `accepted`/`enableNow`/`drafts`/`buildChanges` still read the FULL `result.new`, so a hidden utility model stays in the confirmable payload (SC#3 / T-159-13, test-locked). Default-on, persisted via `handleSetDiscoveryFilter` → `setFlag("model_discovery_filter_enabled")` → settings re-fetch; honest "N utility models hidden" + a non-destructive ephemeral "Show all".
- [Phase 159]: 159-06 (D-159-03): family-default pre-fill via draft-SEEDING on run (`seedDraftsFromDefaults`) — `isComplete`/`buildChanges` unchanged; `enableNow` stays default-off so `buildChanges` yields `enabled:false` (never auto-enable, T-159-12). "default — confirm" keyed on the static `familyDefaults(id)[field]!=null`; `native_tools` maps true→native / null→unseeded, never "none" (SC#3 by construction). All 6 plans shipped; MODEL-03 flips at `/gsd:verify-work 159` (phase-spanning STRETCH, false-green-avoidance).

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
