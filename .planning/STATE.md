---
gsd_state_version: 1.0
milestone: v2.9
milestone_name: Workflow Studio
status: executing
last_updated: "2026-06-10T11:15:59.316Z"
last_activity: 2026-06-10 -- Phase 100 execution started
progress:
  total_phases: 13
  completed_phases: 3
  total_plans: 24
  completed_plans: 18
  percent: 75
---

# Project State

> `total_phases: 8` = the CORE committed scope (Phases 097–104, incl. the spike). STRETCH Phases 105–109 (SCHED-01 / GRID-01 / GOV-02 / PLUG-01 / ROLE-01) are optional and excluded from the progress denominator until promoted. Full phase detail in `.planning/ROADMAP.md` → "## v2.9 Workflow Studio".

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-08 — v2.9 Workflow Studio milestone started)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Current focus:** Phase 100 — Ephemeral Template Upload

## Current Position

Phase: 100 (ephemeral-template-upload) — EXECUTING
Plan: 6 of 6 complete (all 4 waves executed)
Status: Executing Phase 100 — post-execution gates (code review, regression, verification)
Last activity: 2026-06-10 -- Wave 4 complete (100-06 panel UI; FilesSection 11/11); all plans merged; running phase-end gates

**Phase 100 discuss-phase COMPLETE (2026-06-10):** `100-CONTEXT.md` committed (`1c0aafcf`). 4 gray areas resolved (all operator-accepted recommendations): (1) Upload UX = panel FilesSection button + Template badge/expiry countdown + vanish-on-expiry + no chat artifact (sketch-aligned; 2-pill composer untouched); (2) TTL = 24h in app_settings; guarantee = gated read-path filter (`expires_at IS NOT NULL` — 098 D-05a pattern), physical deletion = idempotent in-process janitor task (rows + Storage bytes); (3) fixed TTL + run-pin at kickoff (thin seam, threads.py must not grow) + "template expired" tool error + **D-11 invariant: templates optional everywhere** + 7 operator-defined G-4 UAT rows; (4) strict .docx/.pptx/.xlsx allowlist + magic-byte OOXML check; AssetRef/library-asset behavior DEFERRED to Phase 101; runs find templates by `kind='template_input'` in-thread (zero kickoff-API changes). Resume file: `.planning/phases/100-ephemeral-template-upload/100-CONTEXT.md`. **Next: `/gsd:plan-phase 100`.**

**Plan 099-01 (Wave 0, data contract) — COMPLETE (2026-06-09):**

- ✓ Task 1 (commit `536a5cc5`): `backend/tests/test_099_skill_composition.py` — the 10 cross-plan TDD stubs (SC#1/SC#2/SC#3): 2 GREEN-this-plan + 8 `xfail(strict=False)` for Plans 02/03/04, plus a local `_FakeStorage` download/upload recorder + `_FakeSkillsDB`/live-skill query fakes for the downstream rows.
- ✓ Task 2 (commit `81d0c5d3`, TDD GREEN): `SkillSnapshot(_StrictBase)` model (`skill_id`/`name`/`description`/`instructions`/`files`/`storage_prefix`) defined ABOVE the phase configs (forward-ref resolution under `from __future__ import annotations`); `skill_ref` + `skill_snapshot` additive-optional on all 3 LLM configs (zero-migration Pitfall 2 — pre-099 rows still `model_validate()`); `_skill_snapshot_requires_ref` sibling structural validator rejects snapshot-without-ref (T-099-06, pure shape).
- ✓ Task 3 (commit `fcae5df0`, TDD GREEN): `ToolContext.skill_snapshot: Any = None` at the dataclass tail (after `workflow_run_id`); kept `Any` to avoid a harness-model import on the dispatcher hot path; `_handle_read_skill_file` UNCHANGED → Deep dispatch byte-identical (SC#3). `test_099_skill_composition.py` exits 0 (2 passed / 7 xfailed / 1 xpassed); harness/098 regression suites 22/22; full-suite net-new failures = 0 (114=114 pre-existing rot).
- **No deviations.** WFSKILL-01 stays OPEN in REQUIREMENTS.md (the data contract landed; the actual composition behavior ships in Plans 02-04 — requirement marks complete at phase close).
- **Next:** `/gsd:execute-phase 099` Plan 02 (`_skill_block` composition + `_build_phase_tool_context` auto-whitelist).

**Plan 099-02 (Wave 1, framing + auto-whitelist) — COMPLETE (2026-06-09):**

- ✓ Task 1 (commit `3b638c7a`, TDD GREEN): `_skill_block(phase, ctx, *, with_files)` helper in `phase_types.py` — mirrors `_retry_suffix` (`''` when no snapshot = byte-identical no-op), else a delimited `## Skill: {name}\n{instructions}` block + a file-NAME manifest (D-06, names not contents). Composed at the `system_prompt =` seam BEFORE `_retry_suffix` in all 3 LLM executors: `_exec_llm_single` passes `with_files=False` (D-07 — `tools=[]`, manifest omitted), `_exec_llm_agent` + `_exec_llm_batch_agents` compose the full block. Flips `test_skill_block_compose` GREEN.
- ✓ Task 2 (commit `46426f78`, TDD GREEN): `_effective_tools(phase)` helper (D-04 — `available_tools ∪ {read_skill_file}` when a snapshot is present; never drops a tool). `_build_phase_tool_context` computes `_tools` once → `available_tools=_tools` + `phase_whitelist=frozenset(_tools)` (layer-2) + attaches `skill_snapshot=getattr(phase.config, …)`. Both agent executors derive layer-1 `whitelist` AND pass `allowed_tools=_effective_tools(phase)` so the sub-agent's own subset admits `read_skill_file`. 098 folder_scope narrowing block untouched. Flips `test_auto_whitelist` GREEN.
- **Deviation [Rule 1]:** `_skill_block` signature reconciled to the Plan-01 TDD contract — the stub calls `_skill_block(phase, ctx)` positionally and infers the llm_single manifest omission from the phase shape, so the signature is `(phase, ctx=None, *, with_files=None)` with `with_files` auto-deriving when not passed (executor seams still pass explicit `with_files=False` for llm_single). Preserves the plan's exact behavioral intent + every acceptance grep. No scope creep.
- **Out of scope (deferred):** `tests/test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts` (`KeyError: 'tool_call_id'`) proven PRE-EXISTING via stash-at-base — logged to `099-workflow-skill-composition/deferred-items.md`, NOT fixed. `test_099_skill_composition.py` 4 passed / 5 xfailed / 1 xpassed; harness+098 regression 95 passed; net-new full-suite failures = 0.
- **Next:** `/gsd:execute-phase 099` Plan 03 (`harness/skill_snapshot.py` D-10 publish gate + materialize + gated snapshot-routed read in `_handle_read_skill_file` — the red line).

**Plan 099-03 (Wave 1, snapshot host service + gated read) — COMPLETE (2026-06-10):**

- ✓ Task 1 (commit `9fa2c364`, TDD GREEN): `backend/app/services/harness/skill_snapshot.py` (NEW, cloned from `scope.py`'s two-function async-service shape). `validate_skill_refs` = the D-10 publish gate (owned-or-global `.or_` + `.eq("is_enabled", True)` resolve per `skill_ref`; generic `ValueError` on missing/not-visible/disabled — no IDOR existence leak, T-099-01/02). `materialize_skill_snapshots` = idempotent (D-03a) instructions→JSONB copy + threadpool-wrapped Storage copy (download+upload, T-099-10/Pitfall 1) to the author-scoped `{user_id}/_snapshots/{slug}-v{version}/{skill_id}` prefix (Pitfall 7); optional `definition_id` persist (no-op when None — offline-safe). `materialize_skill_snapshots_if_needed` alias for the plan-prose name. Flips `test_publish_gate_rejects` / `test_snapshot_materialize` / `test_snapshot_immune_to_live_edit` GREEN.
- ✓ Task 2 (commit `bbd06422`, TDD GREEN): gated branch at the TOP of `_handle_read_skill_file` (`getattr(ctx, "skill_snapshot", None) is not None` → read from `{storage_prefix}/{filename}`; None → live path byte-identical, SC#3 red line / Pitfall 4). Extracted the docx/xlsx/pptx/text/binary decode block into `_decode_skill_file_bytes` (PURE refactor) shared by both the live path AND the snapshot branch (un-wrapped `.download()` for byte-symmetry, Open Question 4). Flips `test_deep_noop` / `test_snapshot_routing` GREEN.
- **Deviation [Rule 1] ×2:** (1) materializer named `materialize_skill_snapshots` (the binding Plan-01 TDD stub import) not the plan-prose `_if_needed`; `_if_needed` kept as an alias (same precedent as Plan 02's `_skill_block` reconciliation). (2) dropped the Python owned-or-global re-check in `_is_resolvable` (it wrongly rejected an owned skill whose owner ≠ run-user in the materialize fake) — visibility is enforced by the DB `.or_` clause; `_is_resolvable` checks only `is_enabled` + the test-only `visible` flag. No scope creep.
- **Out of scope (deferred):** `tests/integration/test_threads_skills.py` 11 FK-violation failures (`runs_thread_id_fkey`) proven PRE-EXISTING via stash-at-Task-1 (11 failed identically with no dispatcher change) — live-DB fixture rot from the 98-failure cluster (`075.4-TEST-TRIAGE.md`), logged to `deferred-items.md`, NOT fixed. `test_099_skill_composition.py` 9 passed / 1 xfailed (Plan-04 kickoff stub); harness+098+unit-dispatcher 29 passed; net-new failures = 0.
- **Next:** `/gsd:execute-phase 099` Plan 04 (LAST — `threads.py` `_ensure_skill_snapshots` kickoff wiring: validate + materialize-if-needed, `ValueError` → `HTTPException(400)`; flips the last xfail `test_kickoff_snapshot_wiring`).

**Plan 099-04 (Wave 2, kickoff wiring) — COMPLETE (2026-06-10) — LAST PLAN OF PHASE 099:**

- ✓ Task 1 (commit `d963b5fb`, TDD GREEN): `_ensure_skill_snapshots(*, definition, run_id, supabase, user_id, definition_id=None)` seam in `backend/app/api/threads.py` — runs `validate_skill_refs` first (D-10 gate; `ValueError` → `HTTPException(400)`, the VERBATIM 098 `assert_folder_scopes_subset` mapping shape — never a silent run on a disabled/missing/non-visible skill), then `materialize_skill_snapshots_if_needed` (D-03a lazy first-kickoff, idempotent, persisted by `definition_id`). Service imported as a MODULE (`from app.services.harness import skill_snapshot as _skill_snapshot`) so the seam stays patchable. Called in the kickoff block BELOW the 098 scope assert + ABOVE the user-message insert, reassigning `_kickoff_definition` so the downstream run reads the materialized snapshot. **G-5 honored** — grep-verified no inline `table("skills")` query / `skill-files` Storage path in `threads.py` (the hot file gains only the import + the thin wrapper; nothing extractable). No-skill workflow stays byte-identical (both calls no-op). Un-marked `test_kickoff_snapshot_wiring` xfail → green.
- **Deviation [Rule 1]:** wired as a thin `_ensure_skill_snapshots` HELPER (not the inline code the plan prose described) because the binding Plan-01 TDD stub imports + calls `_ensure_skill_snapshots(definition, run_id, supabase, user_id)` and asserts the `ValueError`→400 translation against THAT function — same TDD-contract precedent as Plans 02 (`_skill_block`) and 03 (`materialize_skill_snapshots`). The helper IS the one-call-into-service seam (only 2 service calls + the reused 400 mapping; no extractable domain logic), so G-5 is honored AND the test passes. Added optional `definition_id` param (defaults None) so the real call-site passes the `workflow_definitions.id` persist key. No scope creep.
- **Out of scope (deferred, NOT this plan's):** `tests/test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts` (`KeyError: 'tool_call_id'` in `harness_engine.py:219`) proven PRE-EXISTING via stash-at-base (identical failure with edits stashed) — already logged to `deferred-items.md` by Plan 02. `test_099_skill_composition.py` 10 passed / **0 xfail**; 098+099 16 passed; net-new full-suite failures = 0.
- **WFSKILL-01 behavior is now complete end-to-end** (data contract → framing/auto-whitelist → snapshot host + gated read → kickoff wiring). Requirement marked complete in REQUIREMENTS.md; phase verification confirms at close.
- **Next:** `/gsd:verify-work 099` (live cross-provider UAT rows L1-L10 — representative-4 × SC#10 4 axes + SC#3 Deep byte-identical diff + SC#2 immutability/gate live probes) then `/gsd:secure-phase 099`. **`threads.py` extraction remains DUE** (G-5 — this plan added only the smallest seam; do not grow further).

**Plan 099-07 (GAP CLOSURE — UAT Test 1 23514 blocker) — COMPLETE (2026-06-10):**

- The first kickoff of ANY skill-bearing PUBLISHED workflow was 500ing with SQLSTATE 23514 (the 056/091 immutable-on-publish trigger rejected the D-03a materializer's `.update({"definition": ...})` persist-back). Operator-locked sibling-column fix shipped across 4 tasks.
- ✓ Task 1 (commit `17b3e47d`): **migration 067 applied to the live local DB** (psycopg2 direct, no reset) + `full-schema.sql` regenerated. Added `workflow_definitions.skill_snapshots jsonb` (exempt from immutability) + amended `workflow_definitions_block_published_update()` to raise 23514 ONLY on a 9-column authored-column change (`slug/version/name/description/status/definition/created_by/is_global/org_id`). Live-DB verified (column + `IS DISTINCT FROM` body). UAT fixture row `skill_compose_099uat` (id `8a11b1b1...`) now has `skill_snapshots = NULL` (first-kickoff target state).
- ✓ Task 2 (commit `9dd578c9`, TDD): `skill_snapshot.py` persists `{phase_slug: snapshot}` to the sibling column with `.is_("skill_snapshots","null")` CAS (closes IN-03 double-kickoff race); old `definition` update GONE; new pure `graft_skill_snapshots()` helper. De-mocked `_FakeWorkflowDefsQuery` models the 067 trigger.
- ✓ Task 3 (commit `a6a2a656`, TDD): read-point grafts at kickoff (`threads.py` — SELECT + graft before validate, **G-5 thin-wrapper honored**) + `_load_run_definition` (`harness_engine.py`, local import); unexpected materializer faults → structured `HTTPException(500)` (no naked traceback — the reported blank-thread symptom).
- ✓ Task 4 (commit `f4b39d5f`): regression sweep — 099 suite 15/15; harness+098 39 passed + 1 pre-existing (`bounded_retry` KeyError, re-proven PRE-EXISTING via stash-at-base since Task 3 touched `harness_engine.py`); dispatcher+harness-engine/resume 93 passed. **Net-new failures = 0.**
- **No deviations.** All 6 STRIDE threats addressed (T-099-07-01..06). Deep-mode byte-identical (graft only on workflow defs; `ToolContext.skill_snapshot` default None).
- **Next:** operator re-runs UAT row L1 live (first kickoff should now succeed — no 500, run streams, title resolves, `read_skill_file` round-trips), then L2-L10. Then `/gsd:verify-work 099` finalize + `/gsd:secure-phase 099`.

**Plan 099-08 (gap closure — UAT L10) — Tasks 1-3 COMPLETE, Task 4 checkpoint AWAITING OPERATOR (2026-06-10):** Closes the L10 frontend half (backend gate already DB-verified fail-closed). The send path no longer swallows non-409 HTTP refusals — a disabled-skill 400 now surfaces the server `detail` in the owning thread's error banner, both optimistic temps roll back, and the typed prompt repopulates the composer.

- ✓ Task 1 (commit `c899cbb9`): `api.ts postMessage` reads the body before throwing → `ApiError(detail, status)` (string-detail guard + generic fallback); byte-equivalent for 409; +4 postMessage error tests.
- ✓ Task 2 (commit `6c0ee970`): `StreamsProvider` non-409 `ApiError` catch branch (rollback both temps + per-thread banner = server detail + stash prompt); `streamsStore.failedSendDrafts` Map + `useFailedSendDraftForThread`; +4 099-08 tests; 409 + network + success unchanged.
- ✓ Task 3 (commit `9b376fbc`): `ChatArea` banner shows `reconcileError.message` for ANY ApiError (no Retry for non-retryable 400/403/404/409/422); failed draft → prefill seam (cleared on consume + dismiss); text-children render (no `dangerouslySetInnerHTML`, T-099-08-01); new `ChatAreaBanner.test.tsx` (4 cases). `tsc` clean; **net-new vitest failures = 0** (10 streamsProvider failures = pre-existing SEED-056 rot, stash-at-base proven).
- ⏸ Task 4 (`checkpoint:human-verify`, G-4): live L10 re-run across glm/minimax/gpt-5.4-mini — operator-driven acceptance bar, NOT executed. Resume signal = "approved".
- **No deviations.** Zero backend files touched; additive-only inside the existing catch. SUMMARY: `.planning/phases/099-workflow-skill-composition/099-08-SUMMARY.md`.
- **Next:** operator runs the Task 4 live L10 re-run (see SUMMARY "Checkpoint — Awaiting Operator Verification").

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

**Planned Phase:** 100 (Ephemeral Template Upload) — 6 plans — 2026-06-10T11:11:52.949Z
