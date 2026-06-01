---
gsd_state_version: 1.0
milestone: v2.8
milestone_name: Harness Engine & Workflow Mode
status: ready_to_execute
stopped_at: Phase 093 PLANNED (5 plans / 3 waves, 2026-06-02) — next /gsd:execute-phase 093
last_updated: "2026-06-02T00:00:00.000Z"
last_activity: 2026-06-02
progress:
  total_phases: 9
  completed_phases: 5
  total_plans: 28
  completed_plans: 27
  percent: 56
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-30 after v2.7 close)

**Core value:** The agent acts as an AI colleague -- it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** Phase 093 — Harness Cross-Provider Parity (PLANNED 2026-06-02 — 5 plans / 3 waves; next `/gsd:execute-phase 093`)

## Current Position

Phase: 093
**Phase 092.5 Plan 05 — ✅ COMPLETE 2026-06-01.** The entangled OpenAI/OpenRouter/Ollama branch extracted VERBATIM into `provider_gateway/openai_compat.py`; third `_on_chunk` folded into the ONE shared consumer handler; `calling_mode` surfaced through the seam (structurally fixes the harness-OpenAI-only bug). All 3 provider families now dispatch through one gateway home. Verified non-regressing 3 ways: seam+chunk_handler 17 passed/0 skipped; full-suite ZERO net-new attributable to Plan 05 (worktree A/B vs 4a4bd327 — 6 comm-deltas proven flaky live-infra); adversarial 6-lens byte-identical review = ZERO breaking deltas. 2 suspicious (non-breaking) deltas → Plan 06 live gate. Commits 8635d989 (T1) + 14b75c96 (T2) + dfc2c915 (T3) + 3d115112 (summary). See 092.5-05-SUMMARY.md.

**Phase 092 — ✅ CLOSED 2026-06-01 (passed_with_overrides).** Dual-mode wiring (MODE-01/MODE-02/CONT-01) proven end-to-end on OpenAI; F1–F8 closed; the 2 cross-provider/transport defects F9 (harness OpenAI-only) + F10 (ask_user round-trip) operator-routed to Phase 093 (built on 092.5). See `092-VERIFICATION.md` + `092-07-SUMMARY.md`.

--- (historical 092 execution trace below — retained for audit) ---

Phase: --phase (092) — EXECUTING
Plan: Not started
Plans: 4 plans / 4 waves (sequential, 1 plan per wave). Wiring phase — connects the Phase 090/091 harness substrate to the live app: MODE-01 (Deep/Harness mode switch + workflow-run creation), MODE-02 (server-side Harness→Deep authz lock), CONT-01 (Continue button). OWNS the workflow-start trigger (INSERT INTO workflow_runs) that unblocks 091's persisted cross-provider UAT + closes SEED-047 (persist inputs+model into resume ctx).

  - Wave 1: 092-01 (schema migration 063 + test foundation — autonomous:false, operator SQL-editor apply checkpoint)
  - Wave 2: 092-02 (MODE-01 mode switch + workflow-run creation + MODE-02 server-side lock-refusal — autonomous)
  - Wave 3: 092-03 (MODE-02 cancel/terminal lock-clear + CONT-01 Continue — autonomous)
  - Wave 4: 092-04 (frontend: Deep/Harness toggle + published-workflow picker + Continue button — autonomous:false, UAT checkpoint) — CODE SHIPPED (Tasks 1-3), UAT FAILED at Task 4
  - Gap 1: 092-05 (F1 audit-owner crash + F2 wedged lock — backend) — ✅ COMPLETE 2026-05-31 (4 tasks; F1+F2 closed; live-DB audit test green; zero net-new full-suite failures)
  - Gap 2: 092-06 (F3 client lock-UX + UAT re-run gate) — ⚠️ CODE-COMPLETE 2026-05-31 (Tasks 1-2 shipped, tsc+build clean); Task 3 UAT = gaps_found → NEW blocker F4 (harness sub-agent parent_run_id FK) blocks end-to-end workflow → phase NOT complete
  - Gap 3: 092-07 (F4 harness sub-agent parent_run_id FK mismatch — backend + frontend) — ✅ CLOSED 2026-06-01. Tasks 1-5 (code+tests) DONE 2026-05-31; Task 6 binding UAT resolved by operator close decision 2026-06-01 → **passed_with_overrides**. F4 id-routing closed across 3 facets + the unblocked F5/F6/F7/F8 dominoes closed → a Harness workflow runs end-to-end + renders a grounded sources+confidence answer (live on OpenAI). Commits: fa14a1c3 (Facet A), ca0ee5c5 (Facet B), 0f6a66df (Facet C resume), cdd775f6 (Facet C Continue-404 + surfacing + frontend), ec9dd4f4 (live FK test), 69e01300 + 2aa25777 (test-pollution); F5–F8: a7be6423/803aafd3/ba5949c4/95da3032/27b12c37. Backend full-suite ZERO net-new failures vs 092-03 baseline; frontend tsc -b 54 baseline (0 net-new) + vite build clean. **F9 (harness OpenAI-only) + F10 (ask_user round-trip) → Phase 093 (operator directive, UPDATE 5).** See 092-07-SUMMARY.md + 092-VERIFICATION.md.

**092-05 (gap-closure) verdict (2026-05-31): ✅ COMPLETE.** F1 closed — `workflow_runs.user_id` persisted (migration 064), `write_audit` binds the run-owner, all 11 audit sites pass it (10 harness_engine + 1 tool_dispatcher); a harness run executes end-to-end with no `NotNullViolationError`. F2 closed — `_shielded_finalize` terminalizes `workflow_runs` + clears the anchor on any non-completed harness escape; `lock_is_stale` self-heals on a terminal producer run (pure read). Live-DB integration test (`test_092_harness_audit_live.py`) closes the 091 mock blind spot — both gates green vs local Postgres. Full backend suite: 103-failed/1014-passed vs 102/1008 baseline = +6 new passing tests, ZERO net-new failures (the one "new" entry, `test_bounded_retry_reaches_failed_after_3_attempts`, is a pre-existing isolation failure unrelated to this plan). Requirements MODE-01/MODE-02/CONT-01 stay OPEN — 092-06 (F3) + phase verification own closure. Operator live F1 proof (backend kickoff of a Research→Summarize workflow) still pending per VERIFICATION.

**Wave 4 UAT verdict (2026-05-31, Chrome MCP, operator-confirmed): FAILED — see `092-04-UAT-FINDINGS.md`.**
Verified working: MODE-01 toggle/picker/gating, MODE-01 atomic workflow-run creation (INSERT workflow_runs + anchor + lock; correct ThreadWorkflowState — the trigger that unblocks 091's parked UAT), MODE-02 server-side 409 lock-refusal.
Findings → gap-closure **092-05**:

- **F1 CRITICAL** — `write_audit` omits `user_id`; `harness_audit.user_id` NOT NULL; `workflow_runs` has no `user_id` column; `create_workflow_run` never persists one. First `run_started` audit write throws `NotNullViolationError` → run dies before any phase → empty assistant / no tool calls / no workspace. Harness mode end-to-end non-functional. (Missed in 091: audit write was mock-only; 092 is the first live run.)
- **F2 HIGH** — failure leaves `workflow_runs.status='active'` → thread stuck `locked`/`lock_is_stale:false`, no UI recovery.
- **F3 MEDIUM (UX)** — composer not disabled-while-locked on active thread (toggle/agent-selector/textarea/Send live); 409'd send added optimistically, no error toast, orphaned assistant placeholder.

Previously blocked by F1 (now UNBLOCKED at the audit layer): SC#5 reload-reconcile, SC#2 DB-NULL, CONT-01 cap-drive, SC#10 scoreboard — but now re-BLOCKED at the phase-execution layer by F4 (see 092-06 verdict below).

**092-06 (gap-closure F3) verdict (2026-05-31): ⚠️ CODE-COMPLETE, phase verification gaps_found — see `092-06-UAT-FINDINGS.md` + `092-06-SUMMARY.md`.**
F3 frontend lock-UX SHIPPED (Tasks 1-2): typed status-carrying 409 ApiError; per-thread workflow lock seeded at Harness kickoff + seeded/cleared on the mount-time getThreadWorkflow reconcile (D-v2.5-03 / F2 self-heal); textarea+Send+canSend gate on workflowLocked with the D-05 running hint; a 409 rolls back BOTH optimistic bubbles + surfaces a fixed per-thread lock banner (no internals leaked). tsc -b = 54 baseline (0 net-new), vite build clean. Commits 3b21f230 + 4546b5bb. Deviation: 1 auto-fix (Rule 3 — ApiError as explicit class field not a TS parameter-property, erasableSyntaxOnly-safe).
Task 3 lived-experience UAT (orchestrator Chrome MCP + operator live Supabase + uvicorn console) = **gaps_found**:

- **F1 ✅ VERIFIED CLOSED live** — workflow_runs row created with non-null user_id; harness_audit phase_started row with non-null user_id; no NotNullViolationError.
- **F2 ✅ VERIFIED CLOSED live** + **SC#2 ✅ PASS (failure path)** — failed run → workflow_runs.status='failed' + threads.active_workflow_run_id=NULL; no wedged lock. (Natural-completion + explicit-Cancel SC#2 variants still owed once F4 lets a workflow finish.)
- **F3 ⚠️ CODE-COMPLETE, LIVE-UNVERIFIED** — live lock-honored / 409-rollback unobservable because the workflow dies in ~2s (F4) so no thread stays locked. Composer correctly showed unlocked for the already-terminal run (anchor NULL) — consistent, not a defect.
- **F4 NEW BLOCKER** — harness LLM-agent phase sub-agent insert fails with `ForeignKeyViolationError: runs_parent_run_id_fkey`: the engine ctx.run_id is the workflow_run id (threads.py:1158) which isn't a `runs` row, but `run_task_sub_agent` (task_service.py:272) uses it as `runs.parent_run_id`. Workflow cannot run end-to-end. OUT OF SCOPE for 092-05/092-06 → routed to gap plan **092-07**. Fix shape: thread the producer-shell `runs` id into the engine ctx as a distinct `producer_run_id` and use THAT for `runs.parent_run_id`, keeping ctx.run_id = workflow_run id for audit/SSE/resume — cover BOTH the live producer ctx (threads.py) AND the resume ctx (harness_engine._build_resume_context). Cross-provider + agent-loop-adjacent → needs its own scoped UAT.
- **SC#3 / SC#5 / CONT-01 / SC#10 native-7 / Deep byte-identical: ⛔ BLOCKED by F4** — they ride a workflow that runs end-to-end.

~~Requirements MODE-01 / MODE-02 / CONT-01 REMAIN OPEN~~ → **RESOLVED 2026-06-01.** 092-07 shipped (F4 + the F5–F8 dominoes); a Harness workflow runs end-to-end on OpenAI. **Phase 092 ✅ CLOSED (passed_with_overrides); MODE-01 / MODE-02 / CONT-01 = Validated.** The two remaining BINDING defects (F9 cross-provider harness parity, F10 ask_user round-trip) were operator-routed to a comprehensive follow-on phase (UPDATE 5) → **Phase 093** (Harness Cross-Provider Parity), built on **Phase 092.5** (Provider Gateway Extraction, planned). NEXT: `/gsd:execute-phase 092.5`. See 092-VERIFICATION.md.

### Phase 091 (prior) — ✅ COMPLETE

8 plans / 6 waves — VERIFICATION PASSED (iteration 2). Gap-closure plan 091-08 (wave 6) closed all code-review Criticals + actionable Warnings; 091-REVIEW.md status → resolved.

Reqs covered: HARNESS-01, HARNESS-03, HARNESS-04, HARNESS-05, HARNESS-07, TOOL-05 (all 6). Highest-risk surfaces isolated with deterministic proof: 2-phase write (Plans 02/04), ask_user re-subscribe subscribe-before-emit (Plan 04). Migration 061 (4 seed templates) applied LIVE via the operator SQL-editor checkpoint (no db push) — all 4 rows present, published, global; full-schema.sql unchanged (data-only migration; tables already present from migration 060). 4-axis UAT (SC#10) in VALIDATION manual-only rows — owned by the verifier.

Prior phase: 090 (Harness Schema + RLS + Config Models) — ✅ COMPLETE. 3/3 plans + migration 060; substrate live (4 tables + threads.active_workflow_run_id), RLS + immutable-on-publish + INSERT-only audit confirmed against live DB.
Scope: HARNESS-01..07 (state-machine workflow runtime, 5 phase types, validation gates, resumable runs, audit, seed templates) + MODE-01/02 + CONT-01 (Continue) + PANEL-08/09 + A11Y-03 + EVAL-01/02 + CONC-01 + TOOL-05 + FOUND-03 (G-5 extraction) + CF-01 (carry-forward sweep) + 2 polish riders (CHAT-04 chat-card unification, PARITY-01 Anthropic parity). PLUGIN-01..03 + `super_admin`/operator role tier DEFERRED to v2.9. See PROJECT.md D-v2.8-01.
Phase 091 ✅ COMPLETE (2026-05-31): all 8 plans shipped (Waves 1-6); verification 6/6 automated must-haves, status human_needed → operator-approved. Gap-closure 091-08 closed both code-review Criticals (CR-01 resume double-exec via claimed_at lease CAS/migration 062 + CR-02 silent >64KB output loss) + WR-03/04/05/06 + IN-01; 091-REVIEW.md → resolved. Harness suite 95/95 green vs live DB. SC#10 4-axis cross-provider UAT persisted in 091-HUMAN-UAT.md — BLOCKED on the Phase 092 workflow-start trigger (no INSERT INTO workflow_runs exists yet). WR-01/WR-02 (resume ctx inputs/model rehydration) DEFERRED to Phase 092 via SEED-047 (re-open trigger: 092 run-creation persists workflow_runs.inputs+model; Phase 096 EVAL-02 is the proof gate).

Next: Phase 092 — dual-mode wiring + Continue button. No CONTEXT.md yet → start with `/gsd:discuss-phase 092` (recommended) or `/gsd:plan-phase 092`. Note for 092: it OWNS the workflow-start trigger (run creation) that unblocks 091's persisted cross-provider UAT, and must persist workflow_runs.inputs+model to close SEED-047.
Phase order + dependencies: 089 (extract, BLOCKING, ships first) ‖ 090 (schema, parallels 089) → 091 (engine + 5 types + gates + whitelist; whitelist folds in here) → 092 (dual-mode + Continue) → 094 (panel timeline). 093 (Anthropic parity) after 089. 095 (chat-card) after 089. 096 (eval + verify) last, after all features.
G-5: SATISFIED by Phase 089 (`threads.py` 3,186 LOC extraction).
G-2 FIRES: Phase 094 (panel phase timeline) AND Phase 095 (chat tool-card unification) — `/gsd:sketch` before spec/plan; operator-approved mockup is the acceptance bar.
SC#10 4-axis UAT (cross-provider × multi-tool × parallel-thread × long-message) baked into success criteria for 089, 091, 092, 093, 094, 095, 096.
Carry-forwards into v2.8 (verify at kickoff via CF-01 in Phase 089): BUG-260527-01 title-gen (DeepSeek/Moonshot/Google, fixed-but-unverified), Google secondary-model 404, download-link payload. 087 panel deferrals SEED-037/038/039 (037 download → standalone `/gsd:quick`).

v2.8 CLOSURE CHECKLIST (do NOT do per-phase):

- SECURITY PASS — run `/gsd:secure-phase` over the workflow-runtime phases 090 → 091 → 092 at milestone closure (anchor on 092, where the server-enforced Harness→Deep authz lock lands). Risk-based: these 3 phases hold the milestone's real security surface (RLS / tool-whitelist execution gate / server-side mode lock); 093/094/095 are low-surface UI/provider polish. Not urgent because 090 RLS is already live-verified and 091's code review already cleared eval/SQL-injection/secrets + the whitelist no-op invariant. PULL FORWARD to right after 092 ONLY if v2.8 ships to real/production users before closure. (Project has produced SECURITY.md only twice ever — secure-phase has never been per-phase here.)

Last activity: 2026-06-01

Progress: [█████████░] 93%
<!-- v2.8 phase progress: 089/090/091/092 complete (4/9); 092.5 EXECUTING (Plans 01-05/6 done — skeleton + baselines + clean Anthropic/Google + entangled OpenAI-compat all extracted, Deep verified byte-identical; Plan 06 = operator PROOF GATE #2 (final native-7 SSE diff) next); 093/094/095/096 remaining -->

### Phase 092 Plan 05 (gap-closure) — ✅ COMPLETE

4 tasks (Task 1 operator-migration checkpoint resolved; Tasks 2-4 executed). F1 (harness_audit.user_id crash) + F2 (wedged lock) closed; live-DB audit integration test added (closes 091 mock blind spot). Commits: 160bb729 + 88e05f07 (migration 064 + full-schema), cd592935 (F1), 27afae18 (F2), c5388ec0 (live test). Deviation: 1 auto-fix (Rule 3 — tool_dispatcher 11th write_audit caller). See 092-05-SUMMARY.md.

**Phase 093 PLANNED (2026-06-02):** Harness Cross-Provider Parity + Phase-Type Hardening — **5 plans / 3 waves**, single req PARITY-02. CONSUMPTION + plumbing phase (~zero net-new logic; 092.5 gateway shipped). Wave 0: 093-01 (autonomous:false — 7 RED test scaffolds + split_topic kickoff_prompt alias + INPUT_UNSATISFIED lint [D-10] + migration 065 seed fixes via the operator SQL-editor trigger-disable approach [056 immutability trigger BLOCKS a plain UPDATE — RESOLVED]). Wave 1: 093-02 (task_service gateway-consumption rewrite = F9 core, the highest-risk task, carries the byte-identical-Deep guard D-14 + IN-05 sync-generator trap) ‖ 093-03 (model-resolver field fix available_models [D-06, dead since Phase 085] + resolve_workflow_ctx_model wrapper [D-04/D-05] + Google default Open-Q1 probe). Wave 2: 093-04 (ask_user F10 workflow_run-id fallback [D-07/D-08, mirrors runs.py:645-670; T-093-IDOR HIGH] + Continue ctx-model thread) ‖ 093-05 (shared surfacing helper [D-11, Pitfall-5 single-persist-owner] + live/resume ctx-model thread + ask_user draft carry [D-12]). Zero within-wave file overlap (verified). The native-7 × 5-phase-type × 4-workflow LIVE UAT (D-13/SC#6) is authored in 093-VALIDATION.md, owned by the verifier — NOT plan tasks. Open Q1 (Google served-model) resolved in 093-03; Open Q2 (resume/Continue user_settings load) decided in-plan (093-04/05); Open Q3 (056 trigger) resolved (trigger-disable migration). RED LINE: Deep byte-identical on all 7 (only 093-02's task_service rewrite touches a shared LLM path — guarded). Next: `/gsd:execute-phase 093`.

## Performance Metrics

**Velocity:**

- Total plans completed: 43 (v2.7)
- Prior milestones: v2.6 shipped 91 plans in 16 days (~5.7 plans/day)
- Average duration: ~12min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 083 | 3 | - | - |
| 084 | 5 | - | - |
| 085 | 5 | - | - |
| 087 | 5/5 | - | ~8min (087-02) |
| 088 | 5 | - | - |
| 089 | 4 | - | - |
| 091 | 8 | - | - |
| 092.5 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: (from v2.6 close)
- Trend: Stable

| Phase 088 P088-01 | 13min | 3 tasks | 15 files |
| Phase 088 P088-02 | 6min | 2 tasks | 1 files |
| Phase 088 P088-03 | 3min | 2 tasks | 1 files |
| Phase 088 P088-04 | 75min | 3 tasks | 4 files |
| Phase 088 P088-05 | 1h 40m | 3 tasks | 2 files |
| Phase 089 P02 | 6min | 3 tasks | 3 files |
| Phase 089 P03 | ~3h | 3 tasks | 35 files |
| Phase 091 P01 | 7min | 3 tasks | 10 files |
| Phase 091 P02 | 7min | 3 tasks | 7 files |
| Phase 091 P06 | 5min | 2 tasks | 5 files |
| Phase 091 P03 | 7min | 3 tasks | 6 files |
| Phase 091 PP05 | 7min | 3 tasks | 5 files |
| Phase 091 P04 | 5min | 3 tasks | 5 files |
| Phase 091 P07 | ~14min | 3 tasks | 2 files |
| Phase 091 P08 | ~20min | 3 tasks | 12 files |
| Phase 092 P01 | 25min | 3 tasks | 6 files |
| Phase 092 PP02 | ~40min | 3 tasks | 9 files |
| Phase 092 P03 | 75min | 3 tasks | 9 files |
| Phase 092 P05 | ~45min | 4 tasks | 8 files |
| Phase 092.5 P01 | 18min | 3 tasks | 4 files |
| Phase 092.5 P03 | ~35min | 3 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- (092.5-03, 2026-06-01): clean-provider gateway adapters return the BARE `stream_*` SYNC generator (NOT an async wrapper) — `stream_anthropic`/`stream_google` are `Generator[dict,None,None]` driven by the consumer's threadpool `_drain_stream_with_close_on_cancel` (`for chunk in stream:`) + `close_fn=stream.close`; a bare passthrough is the ONLY design that keeps drain/close byte-identical (an async re-wrap would change the cascade-surface machinery). Plan-01's async-generator seam-test fakes were a scaffold assumption; the real boundary is sync, so the seam test was adapted to sync-drive.
- (092.5-03, 2026-06-01): the two clean branches collapse into ONE `if active_provider_name in ("anthropic","google")` gateway-dispatched branch + ONE shared `_on_chunk` — byte-identical because the Google `_on_chunk` was a structural copy of Anthropic's and the only divergence (thought_signature hydration in the finish branch) is a NO-OP for Anthropic (its tool_calls carry no sig). I2/D-07 hydration STAYS consumer-side (mutates tool_calls_buffer); adapter only EMITS the finish sig. `GatewayRequest.tools` widened to `list|None` to carry active_tools' None signal verbatim.
- (092.5-05, 2026-06-01): the entangled OpenAI/OpenRouter/Ollama unit (D-04) extracted VERBATIM into `provider_gateway/openai_compat.py` — the adapter OWNS + EMITS (`<think>` machine, `reasoning_content` routing, `_accumulate_chunk_usage` with BOTH Google-cumulative + OpenAI-`+=` branches intact, per-provider 5KB boundary dicts kept INDEPENDENT) and SURFACES `calling_mode` via the `(stream, calling_mode)` tuple (Pitfall 3 — the structural fix for harness-OpenAI-only). The consumer KEEPS verbatim: `parse_structured_tool_calls(full_content)` post-parse (L-3, reads full_content post-drain), STRUCTURED messages injection (L-1), provider-error retry/cap-pause/end_turn/empty-retry/round-trip persistence (L-5). NO synthetic `tool_start` (Open Q2) — adapter emits `tool_preparing`+`tool_args_progress`, consumer rebuilds `tool_calls_buffer`. Per-stream adapter-local state (`_in_think_block`, usage totals) replaces the original per-iteration nonlocal reset (verified equivalent: one stream = one tracker). NO "while-I'm-in-here" cleanup (075.x-cascade guard). Verbatim-ness proven by a 6-lens adversarial byte-identical review (ZERO breaking deltas) + worktree A/B full-suite (ZERO net-new). 2 suspicious-but-non-breaking deltas (tool_call `id` last-write→frozen-at-`tool_preparing`; failed-mid-stream usage nonlocal→dropped-on-raise) deferred to the Plan 06 live SSE gate.
- (D-093-RESCOPE, 2026-06-01, operator-confirmed at /gsd:discuss-phase 093): **Phase 093 rescoped** "Anthropic Cross-Provider Parity" → **"Harness Cross-Provider Parity + Phase-Type Hardening"**, grounded in the 092 comprehensive audit + a live-code verification sweep. The harness path works on **OpenAI only** (1 of 4 seed workflows, 1 of 7 providers) — a harness-substrate problem, NOT a Deep problem (Deep is provider-robust on all 7). **NEW Phase 092.5 (Provider Gateway Extraction)** inserted to ship FIRST (extract `agent_loop.py`'s provider dispatch into ONE shared gateway, Deep byte-identical; operator's "separate per feature" instinct). 093 then CONSUMES it: shared model-resolver (resolve, don't mutate), ask_user round-trip (Option (i) endpoint-detects-workflow_run), split_topic+batch+verify-gate fixes, 5 phase-types hardened safe-by-construction (reachability lint extended), resume/Continue answer surfacing + draft plumbing. **Phase 094 EXPANDED** → Workflow Legibility + Mode Clarity (audit Phase B + D-092-UX), renders 093's events, sketch-first. **PARITY-01 (Deep-mode Anthropic polish) RE-DEFERRED**; admin/settings-at-scale → SEED-024/012. RED LINE: investigate first, never break working things; Deep byte-identical. New reqs GATEWAY-01 + PARITY-02. Sources: 093-CONTEXT.md + 092-COMPREHENSIVE-AUDIT.md. **NOTE: 092 must close first (092-07 Task 6 UAT still pending), then 092.5, then 093.**
- (D-092-UX, 2026-05-31, operator-approved after strategy-brief research): **Composer consolidation target = A+C** — fold Provider INTO Model (one grouped pill) AND move workflow-START out of the composer into the Phase 087 workspace panel ("▶ Run workflow"). Composer settles to `[ Model ▾ ] [ General/Explorer ▾ ]`. Rationale: Deep/Harness ⊥ General/Explorer are orthogonal axes (2×2), not 4 sibling modes; rendering them as identical pills is the confusion. Workflows stay THREAD-bound (shared run SSE/anchor/lock) — NOT a separate `/workflows` route (would fight 068/075.x reconciliation arch). G-2 sketch-before-plan FIRES → `/gsd:sketch` before any plan-phase. Moving workflow-start to the panel also SHRINKS the F3 lock-UX surface. Source: 092-WORKFLOW-UX-STRATEGY-BRIEF.md.
- (D-092-AUTHOR, 2026-05-31, operator-approved): **Workflow authoring = NL-describe→strict-parse→form-edit→lint-on-publish; NOT a visual drag-canvas** (the squeezed-dead middle per 2025-26 evidence). Phase 091 already shipped the back half (WorkflowDefinition validation + reachability lint + immutable-on-publish + RLS). **Ship Authoring Phase A (draft/edit/publish API only — reuses shipped validator+lint, no schema change) as a small late-v2.8 add** so the dual-mode picker shows user-authored workflows, not just the 4 seeds. NL-generate (B) + guided form editor (C, G-2 sketch) + optional read-only DAG (D) → v2.9 alongside the Plugin Contract. Differentiation thesis: KB-grounded phases (anti-Glean) + native sandbox-code phases + persistent shareable skills + NL-to-WorkflowDefinition safe-by-construction + first-class gates/human-input — no competitor combines these. Source: 092-WORKFLOW-UX-STRATEGY-BRIEF.md.
- (v2.8 roadmap): 8 phases (089-096) derived from 21 requirements; research A→G build order adopted with 2 polish riders sequenced after the extraction
- (v2.8 roadmap): whitelist enforcement (research "Phase D") folds into Phase 091 — shares the ToolContext construction site, NOT a separate phase
- (v2.8 roadmap): G-5 satisfied by Phase 089 (threads.py extraction lands FIRST, behavior-preserving, byte-identical SSE gate)
- (v2.8 roadmap): G-2 fires for Phase 094 (panel timeline) AND Phase 095 (chat-card unification) — sketch-before-plan mandatory
- (v2.8 roadmap): migrations renumber from real head 056+ (PRD's 125-139 reservation is stale fiction); deep_mode_metadata column dropped (no v2.8 consumer)
- (v2.8 roadmap): zero new dependencies — harness is ~80% composition of shipped task_service / ask_user_service / tool_dispatcher primitives; all SSE rides existing run:{run_id} stream
- (D-v2.8-01): v2.8 = harness + dual-mode only; Plugin Contract + super_admin/operator role tier deferred to v2.9 (lock on harness telemetry)
- (v2.8 mode-axis clarification, operator-raised): Deep/Harness is ORTHOGONAL to the existing `agent_mode` (General/Explorer). "Deep Mode" = `active_workflow_run_id IS NULL` (umbrella for General AND Explorer, unchanged); the HARNESS-05 whitelist guard is a no-op in Deep Mode so Explorer's 6-KB-tool set is untouched when no workflow runs. Phase 089 extraction MUST preserve the Explorer branch byte-identically (UAT covers it); Phase 092 owns the small UX call of what the General/Explorer selector does DURING an active workflow. No architectural conflict.
- (v2.7 roadmap): 6 phases derived from 22 requirements; research consensus confirmed build order
- (v2.7 roadmap): G-5 mandated -- threads.py extraction is Phase 083, prerequisite for all new tools
- (v2.7 roadmap): G-2 fires for Phase 087 (Panel UI) -- sketch-before-plan mandatory
- (v2.7 research): ask_user requires Redis pub/sub for cross-worker safety (asyncio.Event fails with WORKER_COUNT=2)
- (083-03): Kimi thinking filter uses state-machine with _in_think_block; provider-gated on moonshot + deepseek
- (083-03): _SINGLE_MODEL_PROVIDERS frozenset classifies provider tiers for title gen model routing
- (087-01): Sheet bottom-sheet hand-authored on installed @radix-ui/react-dialog (side=bottom) — NOT npx shadcn add sheet (avoids vaul); zero new dependency (A3)
- (087-01): --warning-foreground darkened to deep-midnight ink (240 60% 8%) for ≥4.5:1 on amber bg (UI-SPEC), rather than lightening text
- (087-01): WorkspaceFileContent is a discriminated union over storage_type (inline|bucket) so Plan 03 preview routing is type-safe
- (087-01): Wave 0 panel tests are GREEN-only it.todo() contracts (52) mapped to VALIDATION per-req map; each downstream plan flips its own todos to live tests
- (087-03): ShikiCode reused for code preview (A1) — UI-SPEC's literal react-syntax-highlighter is superseded; RSH stays unused, no new dep
- (087-03): CsvTablePreview is a hand-rolled quote-aware splitter (no CSV lib, D-01); malformed/ragged/≥2000-rows/>256KB all short-circuit to the calm fallback before DOM build (T-087-07)
- (087-03): fileFlash added as an index.css @keyframes + .animate-fileFlash utility (prefers-reduced-motion guarded), mirroring brandPulse/checkPop — no Tailwind config change
- (087-04): unified-diff parsed CLIENT-SIDE via pure parseUnifiedDiff (no diff lib, SC#3) — backend already emits the difflib string; Unicode minus (U+2212) for del signs per UI-SPEC
- (087-04): shared DiffLines presentational renderer (5th file beyond the plan's 4) so VersionDiff in-column diff + DiffExpandOverlay wide diff share one render path; ⤢ overlay reuses the SAME parsed payload — no second fetch (D4)
- (087-04): VersionDiff defaults to latest-two (Compare v{n-1}<->v{n}); red-base/green-target pills carry text+aria (base/target version N), not color-only
- (087-05): A2/Pitfall-1 resolved concretely — Send Answer gated on (pick OR type) AND run_id!=null; pure-SSE prompt (no run_id) triggers reconcile-if-missing + shows "Preparing…"; NEVER POSTs without a reconciled run_id (would 404)
- (087-05): answer flow is optimistic-then-reactive — optimistic green .answered on 200, then ask_user_response SSE removes the prompt from the store → card unmounts + run un-pauses (D4)
- (087-05): seam mode signal reuses per-message runStatus==='streaming' (live=pointer/cue, terminal/rehydrated=card) — no new global state; D-05 single source of truth (live in panel, history in transcript)
- (087-05): SeamCard closes the documented ask_user reload gap (answered Q&A in chat on reload) — the OPEN FOLLOW-UP the Phase 086 surface note flagged
- (087-05): seam open handlers (onSeePanel/onOpenPanel) left as optional unwired props — Plan 02 panel shell owns the panel-open action and wires them; renderers degrade to no-op click until then
- (087-05): MessageItem seam mounts are PURELY additive (102 insertions / 0 deletions); RunCard call shape preserved; BUG-260529-02 surface untouched (G-5)
- (087-02): seam open handlers wired via a module-level event bus (panelOpenSignal — subscribeOpenPanel/requestOpenPanel) instead of re-plumbing onSeePanel/onOpenPanel through MessageList→ChatArea; keeps the G-5 MessageItem change to 6 ins / 0 del and carries no thread data (PANEL-06 / T-087-17 safe)
- (087-02): WorkspacePanel state machine — header button CYCLES open→rail→hidden→open; ⌘./Ctrl+. TOGGLES open↔hidden; rail icon / seam pointer EXPANDS to open
- (087-02): push/split grid lives INSIDE WorkspacePanel's own aside (Pitfall 3 — live ChatLayout is flex not grid); ChatLayout mount is one additive sibling gated on activeView==='chat' (6 ins / 0 del)
- (087-02): mobile (<768px) detected via window.innerWidth + resize (not matchMedia — jsdom-safe); body renders inside the Plan-01 Radix-Dialog Sheet
- (087-02): the fixed-order 'Pending question' slot is satisfied by PendingAskStack PINNED at the very top (087-05 contract), not an extra empty accordion section — avoids the empty-tax the short-circuit forbids
- (087-06): the chat|panel split is now ONE ChatLayout-level CSS grid (1fr | clamp(300-420px)/52px/0) — Pitfall-3 self-referential aside-grid (where 30% collapsed to its 300px floor) REVERSED in favor of panel-shell.md D1; the panel column resolves against the real row width so 1fr+clamp always sums to the row → zero horizontal overflow + flush-right panel + chat centers in its own 1fr column (closes gaps 1 & 7)
- (087-06): WorkspacePanel is now CONTROLLED (state/onCycle/onExpand/onHide props); the open/rail/hidden state machine, the ⌘./Ctrl+. listener, and subscribeOpenPanel(expand) lifted UP to ChatLayout so the persistent chat-header toggle + the seam pointer drive the same state (closes gap 3 — hidden panel reopenable by mouse)
- (087-06): pulsing-amber-dot ask_user-pending indicator on the chat-header toggle computed in ChatLayout via useAskUserPrompt(useViewingThread()) — workspacePending = pending.length>0 && state!=='open'; motion-safe:animate-pulse honors prefers-reduced-motion, no new store (closes gap 4 / PANEL-01)
- (087-06): DevTwoPaneMock import+mount removed from production App.tsx (file retained for dev); T-087-06-01 info-disclosure mitigated (closes gap 2)
- (088-01): vitest-axe (NOT jest-axe) wired as the structural-a11y matcher — runner is Vitest 4.1.0; D-13's jest-axe was the wrong binding (RESEARCH correction #2)
- (088-01): global :focus-visible ring added to index.css @layer base via zero-specificity :where(...) — a floor, not an override (components with their own focus-visible:ring-* still win)
- (088-01): A11Y-01/02 structurally GREEN + axe-gated on all 8 panel components (89/89), no component restructure needed (no D-09 SEED); contrast/focus-ring real-verification deferred to Plan 05 Chrome MCP Lighthouse (Pitfall 5)
- (088-02): cross-provider eval script switches provider via the per-request MessageCreate.provider/model override (threads.py:1285), NOT a persistent user_settings UPDATE — measures the REAL active_system_prompt (Pitfall 2) with zero global-state mutation
- (088-02): scripts/eval_cross_provider.py is the SEED-034 fold-gate evidence source (D-05) — greppable EVAL_ROW/EVAL_SUMMARY scoreboard; Plan 04 re-runs it before/after a text-only prompt change to prove +1 failing model passes / 0 strong regressions. Authored here, run LIVE in Plans 04/05 (operator backend) — this is the v2.8 harness eval seed (EVAL-01)
- (088-04): SEED-034 VERDICT = FOLDED — text-only universal write_todos + ask_user directive kept at 2f6e2523; AFTER 6x4 eval = condition-b MET (OpenAI/Anthropic/OpenRouter multi-tool write_todos FAIL->PASS) + condition-c MET (zero fold-attributable regression) + condition-a git-diff-proven text-only (TASK_TOOL untouched, no tool_choice forcing)
- (088-04): eval PROVIDERS extended 4->6 (operator-approved, additive) — native deepseek + moonshot added as the weak-model fold-gate targets; Google is a constant 404 confound; per-provider task/ask_user gaps + Google secondary-model 404 deferred to v2.8 (eval script is the v2.8 harness seed, D-08)
- (088-05): D-17 gemini-3 thought_signature CLOSED-as-verified — Google-axis deep flow + multi-tool rounds CLEAN (zero 400); transient 088-04 Google 404 is a SEPARATE secondary-model routing artifact (v2.8 CF-01)
- (089-02): eval extended to native-7 — zhipu/glm-4-flash + minimax/minimax-m2.7 appended to PROVIDERS + ZHIPU/MINIMAX_API_KEY presence checks (is_secret, presence-only); choices auto-derive, localhost hard-gate untouched (D-089-09)
- (089-02): byte-identical SC#3 proof = capture_run_events (XRANGE run:{run_id}) + normalize (mask message_id/run_id, drop captured_at) + diff_event_streams ([] == PASS); operator runbook captures BEFORE baseline against the pre-move loop in Wave 1, AFTER diff in Plan 04 (D-089-08)
- 089-03 (G-5 verbatim move): agent loop lifted byte-identically from threads.py into agent_loop.run_agent_loop; _shielded_finalize + _terminal_status classifier STAY; zero net regression vs baseline (identical 102-failure set)
- 089-03: module-level loop helpers + _reconstruct_history moved to agent_loop.py and re-imported into threads.py (cycle-free, one canonical copy); AgentLoopResult gained persist_system_warnings + run_agent_loop gained timeout_ctx/result_sink kw-only params (Rule-3 structural, behavior-preserving)
- (091-01): harness.py PhaseConfig fields FINALIZED — input_keys (programmatic), model/temperature (llm_single), wall_clock_seconds+model (llm_agent/batch), merge_strategy Literal[concat,concat_numbered], ask_user options+timeout; discriminator/union/extra=forbid/Literals LOCKED; no final_output (D-11)
- (091-01): Wave-0 scaffold = 7 test files + 5 shared fixtures (mock_asyncpg_pool UPDATE-recorder, fake_redis pub/sub+XADD events log, make_tool_context w/ phase_whitelist, make_run_context, build_workflow_definition/four_seed_defs); 22 live anchors green, 27 skipped contracts each name owning plan; ctx factory uses SimpleNamespace so phase_whitelist exists pre-Plan-06
- (091-02): harness_engine.run_workflow drives phases in phase_index order via PHASE_TYPE_REGISTRY seam (LLM never picks next); 2-phase write delegated to db/workflows.py (mark_phase_active before work, complete_phase status+output ONE atomic UPDATE after durable); crash leaves phase active (propagates, never completed); final phase output IS chat message (D-10, no synthesis LLM call)
- (091-02): reachability lint edge model links by phase_index VALUE +1 (not sorted position) so non-contiguous gaps genuinely orphan/strand terminal; 4 seeds lint clean; run-keyed workflow_phases reads use workflow_run_id (42703 guard)
- (091-06): HARNESS-05 whitelist guard at the single dispatch_tool() entry (above _TOOL_REGISTRY.get, below all provider branches) — out-of-phase tool returns the D-04 guiding ToolResult + D-06 tool_refused audit; phase_whitelist=None (Deep Mode) is a literal no-op so Explorer/General stay byte-identical (zero provider-branch edits)
- (091-06): TOOL-05 apply_tool_budget = D-05 layer-1 whitelist filter + per-provider max_tools cap (whitelist tools always retained, soft ceiling yields); max_tools added to ModelCapability (absent=no cap), Google rows=16 (SEED-035). NOT wired into any Deep-Mode get_tools() call site — harness executor (Plan 03) is sole caller, so Deep Mode incl. Google is byte-identical (SC#2)
- 091-03: 5 phase-type executors wrap shipped substrate (run_task_sub_agent / _stream_one_iteration / ask_user pub-sub / programmatic registry); both D-05 whitelist layers wired for LLM-agent phases; split_topic is pure/idempotent; system_prompt_override additive keyword-only on run_task_sub_agent (None=byte-identical)
- 091-05: validation gates (4 closed-registry kinds, all fail-closed) + bounded retry (≤3 attempts, never loops — SC#3) + consecutive-identical short-circuit; on_failure routing fail_run(keep partials+plain reason D-07)/skip_to_phase(D-09)/unknown→fail_run(fail-safe); wall-clock TimeoutError drives same routing (D-12); ctx.retry_feedback PRODUCER (Plan 03 consumes, 07-T2 round-trip); caps sized from existing knobs (Explorer=8 step, 300×8=2400 wall-clock)
- 091-04: resume sweep claims each stranded run via claim_run CAS before re-driving run_workflow (multi-worker safe, WORKER_COUNT=2)
- 091-04: resume_pending_prompt re-emits inside a shared _subscribe_and_block on_subscribed hook -> subscribe-before-emit is structural (Pitfall 2)
- 091-04: answered-vs-pending detection mirrors panel.py /pending raw scan inverted (role=system ask_user_response row by tool_call_id); answered -> skip re-ask
- (092-02): create_workflow_run is the ONLY live-app run-creation path — one atomic txn (INSERT workflow_runs + one workflow_phases per PhaseSpec + threads anchor UPDATE, FK-ordered run-before-anchor); persists inputs+model (SEED-047 wired). Two-row model retained (RESEARCH A2) — producer-shell runs row for SSE-terminal consistency, workflow_runs is the engine row; single lock-clear deferred to Plan 03
- (092-02): producer mode-branch is ONE additive if/else above run_agent_loop — harness builds a loose SimpleNamespace engine ctx (NEVER RunContext, Landmine 7), Deep else byte-identical, zero provider-branch edits. MODE-02 server-side 409 lock refuses a Deep/different-workflow send on a non-terminal anchor BEFORE the user-message INSERT (authoritative, grayed button is courtesy only)
- (092-02): GET /threads/{id}/workflow is a PURE READ (D-v2.5-03) returning ThreadWorkflowState — never writes; lock_is_stale is diagnostic self-heal only (clear owned by cancel/terminal, Plan 03). cap_paused/continues reported from whichever run holds the pause (workflow_runs or latest cap_paused runs row). Published-workflows picker lives in a NEW /workflows router (avoids /{thread_id} param collision)
- (092-02): requirements MODE-01/MODE-02 left OPEN (NOT marked complete) — MODE-02 also needs Plan 03 lock-clear half + Plan 04 frontend; closure deferred to phase verification per execution requirements_note

### Pending Todos

None yet.

### Blockers/Concerns

- **Plan 06 FINAL PROOF GATE — 2nd run 2026-06-01 (OpenAI credits restored): NEAR-PASS, residuals are LLM tool-path noise. Phase still OPEN pending one confirmation lap + e2e env fix.** SSE diff dropped 7→6 BLOCK; **anthropic now byte-IDENTICAL (0 edits)**; the other 6 collapsed to tiny residuals (openai 2, google 3, deepseek/moonshot/minimax 1, zhipu 2) that are EXCLUSIVELY (a) `search_documents`/`grep`/`query_documents` call-COUNT/order variance and (b) `tool_args_progress`/`reasoning_delta` chunk cadence — both the explicitly-volatile categories the skeleton docstring says to JUDGE not auto-fail. Zero regression signature on any provider (terminal `done:error=False` everywhere, no orphaned tool lifecycle, no renamed/unknown event, no `<think>` leak). Edits SHRANK + SHIFTED vs run 1 (non-persistent = noise, not regression). **EVAL backstop PASSES:** native-7 aggregate **16/28 = 16/28 BEFORE** (non-regressing; `factual-doc-search` PASS on all 7; no provider collapsed). Total 17/32 vs 19/32 BEFORE is ONLY OpenRouter losing credit (best-effort, out of gate). **E2E:** all 17 specs failed on the db-teardown guard because `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are UNSET in the Playwright shell (config, not regression) — set both from backend/.env then re-run. REMAINING TO CLOSE: (1) one more clean `--mode after` run to confirm residuals stay non-persistent noise → PASS-by-noise-judgment; (2) e2e env fix + re-run GREEN. Then write 092.5-06-SUMMARY + I1-I8 + close. Earlier note (1st run, env down): operator ran `capture_sse_baseline.py --mode after` → `SSE_DIFF_RESULT: BLOCK` on all 7 native providers. **Triaged to 100% ENVIRONMENTAL, NOT a gateway regression** (8-agent adversarial workflow `wf_b45e948c-45a`, ~561K tokens, all 7 providers + root-cause = unanimous `has_real_regression:false / environmental_fully_explains:true / confidence:high`). Root cause: **OpenAI account out of credits (`429 insufficient_quota`)** → `search_documents` embeddings are hardwired to OpenAI with no fallback (`retrieval_service.py:36` → `openai_service.embed_texts` `:1288`) → document search broke for EVERY chat provider → every skeleton edit = lost `sources/citations/confidence` trailer + LLM fallback tool-path (grep/read_document). Every byte-identical invariant held (tool prep→start→end balanced, code-exec lifecycle intact, no terminal flip except the openai 429 carve-out, no renamed/dropped events, no `<think>` leak, `calling_mode` surfaced — Pitfall 3 honored). Full evidence: **`092.5-06-BLOCK-TRIAGE.md`**. Resilience SPOF captured as **SEED-048** (out of scope for this byte-identical refactor). **NEXT ACTION: operator restores OpenAI billing, then re-runs the gate** (`--mode after` → expect PASS; eval; `cd frontend ; npx playwright test`). Offline re-triage tool: `scripts/_diag_skeleton_diff.py` (pure, no network).
- **Plan 06 live-gate carry-forward (still owed at the CLEAN re-run, from the 092.5-05 adversarial review):** the operator PROOF GATE #2 MUST also confirm the 2 suspicious-but-non-breaking deltas hold on live traffic — (1) the assistant-message `tool_call_id` is non-empty + round-trips on a live MULTI-TOOL turn per compat provider (esp. OpenRouter-proxied, where name-before-id can't be ruled out from code); (2) token totals are non-zero + equal across a normal multi-iteration run per provider. (These need a CLEAN run — Supabase `messages.tool_calls` + `runs` token columns — so they roll to the re-run.)
- **Pre-existing test-infra defect `test_066_langsmith_clean` (2 tests, NOT a Plan 05 regression):** fails in BOTH the pre- and post-extraction trees. Root cause (review-reproduced): `tests/integration/_run_helpers.py:69-88` build bare `MagicMock()` chunks that never set `.usage` → `getattr(chunk,"usage",None)` auto-vivifies a non-JSON-serializable MagicMock → `_accumulate_chunk_usage` poisons `json.dumps` → run finalizes `failed` not `timed_out`; compounded by a stale sync-vs-async timeout monkeypatch (`get_per_call_timeout` vs the `get_per_call_timeout_async` actually called). Fix (test-only, ~2 lines, matches `feedback_mock_completeness`): set `chunk.usage=None` in both `_run_helpers` chunk factories + repoint the timeout monkeypatch to `app.config.get_per_call_timeout_async`. Candidate for a `/gsd:fast` follow-up; intentionally NOT folded into Plan 05 (out of scope + pre-existing).
- Phase 089 (G-5 extraction) is the highest-risk-if-done-wrong phase of v2.8 — a careless "while-I-am-in-here" cleanup re-opens the entire 075.x cross-provider cascade. Acceptance bar is byte-identical SSE per provider (eval + E2E GREEN before AND after), NOT just "tests pass". Carry forward EVERY per-provider round-trip fix verbatim (named checklist in VERIFICATION).
- Phase 091 highest-risk implementation details: the 2-phase write (mark active before work, completed only after durable output) and the `ask_user` resume re-subscription (re-SUBSCRIBE + re-emit pending prompt on startup sweep). Resumability is the trickiest correctness surface.
- AnyIO threadpool live budget (CONC-01 / Phase 096): verify `anyio.to_thread.current_default_thread_limiter().total_tokens` before sizing `llm_batch_agents max_parallel` defaults — PRD cites ~200, AnyIO default is 40, project lifted it; exact current value unknown without a live check.
- Per-provider eval model list (EVAL-01 / Phase 096): needs a curation pass to current model IDs per native provider (model names are representative of provider class, not pinned).
- Phase 094 (panel) + Phase 095 (chat-card) require sketch approval (G-2) before planning can begin.

### Phase 086 surface note — BUG-260528-01 fix (2026-05-28, commit 7d2b3d2)

Surfaced for any reconcile/snapshot/message-list change (relevant to Phase 089 extraction + Phase 094 panel reconcile):

- **What was fixed:** `GET /threads/{id}/snapshot` and `/messages` now filter `role='system'` rows (`.neq("role","system")`). Phase 085's `ask_user` tool persists prompt/response as durable `role='system'` rows (migration 048), but `MessageResponse.role` is `Literal["user","assistant"]` — serializing a system row raised `ResponseValidationError` → **500, thread won't load**. Regression guard added in `test_075_snapshot.py`.
- **Constraint going forward:** any reconcile/snapshot/message-list change MUST preserve this filter, or threads with ask_user history 500 on load again. The `panel.py` `/pending` query (raw asyncpg, scans system rows directly) is the separate path and is unaffected.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260529-0sc | Fix Phase 086 WR-04: persist panel todo/task Maps to localStorage write-path (closes the sole blocking gap from 086-VERIFICATION.md) | 2026-05-28 | 62c1cf0 | [260529-0sc-fix-phase-086-wr-04-persist-panel-todo-t](./quick/260529-0sc-fix-phase-086-wr-04-persist-panel-todo-t/) |
| 260529-1wb | Fix BUG-260529-01: write_todos crashes on stringified `todos` arg — json.loads coercion + isinstance guards so weak/OpenRouter models get a self-correcting error instead of a crash loop (RED→GREEN regression test) | 2026-05-28 | c756522 | [260529-1wb-fix-bug-260529-01-write-todos-crashes-on](./quick/260529-1wb-fix-bug-260529-01-write-todos-crashes-on/) |
| 260530-wjp | Fix cross-provider native-tools: deepseek/moonshot/minimax/zhipu infer native_tools=True on registry-miss model ids (was big-3 only) → real tool calls instead of narrated/fabricated text (closes zhipu/minimax tool-calling + workspace breakage); +`<think>` strip for minimax/zhipu; canonical newest-first model lists (DB). Verified live: minimax-m2.7 real workspace_write + zhipu glm-4-plus real search_documents | 2026-05-30 | d87047c1 | [260530-wjp-infer-native-tools-for-deepseek-moonshot](./quick/260530-wjp-infer-native-tools-for-deepseek-moonshot/) |
| 260530-wvt | Fix title-gen stuck on 'New Chat': strip `<think>`, derive title from user message (not bare 'New Chat'), bump Google budget 60→160. Root cause = token-budget starvation of reasoning models (NOT wrong model name). Verified live across deepseek/moonshot/minimax/zhipu/google — all return sensible titles. Closes BUG-260527-01 + CF-01 C1 (was earmarked Phase 093) | 2026-05-30 | 80f255c6 | [260530-wvt-fix-title-gen-stuck-on-new-chat-strip-th](./quick/260530-wvt-fix-title-gen-stuck-on-new-chat-strip-th/) |
| 260531-00x | Add reportlab==4.2.5 to Dockerfile.sandbox — sandbox had no PDF-WRITING lib (pypdf only reads) so "generate a PDF report" prompts failed. Bumped CLAUDE.md image tag 075.1→075.1.1. Operator must rebuild image + bump SANDBOX_IMAGE (new chats only). Deeper gap (managed package set + agent pip-install-don't-give-up) seeded separately | 2026-05-31 | 7492f1eb | [260531-00x-add-reportlab-to-sandbox-image-pdf-writi](./quick/260531-00x-add-reportlab-to-sandbox-image-pdf-writi/) |

## Deferred Items

### Planned next phases (from 092 strategy brief, 2026-05-31)

- **092-05 (NOW):** gap-closure for 092-04 UAT — F1 (harness_audit.user_id crash), F2 (stuck lock), F3 (client lock-UX). See 092-04-UAT-FINDINGS.md. `/gsd:plan-phase 092 --gaps`.
- **Composer consolidation (NEW phase, post-092, sketch-first):** D-092-UX (A+C). G-2 fires → `/gsd:sketch` first. Use sketch-findings-agentic-rag panel-shell + chat↔panel-seam baseline.
- **Authoring Phase A (NEW small phase, late v2.8):** D-092-AUTHOR — draft/edit/publish API over shipped validator+lint; picker shows user workflows. Re-open trigger: after 092-05 ships (a workflow runs end-to-end), insert before v2.8 close.
- **Authoring B/C/D → v2.9:** NL-generate (eval-gated) + guided form editor (G-2 sketch) + optional read-only DAG. Plant alongside Plugin Contract.

### Phase 094 sketch inputs (operator-raised 2026-06-02 during 093 plan-phase — capture so 094's sketch/discuss addresses them; G-2 sketch-first)

- **When does the agent WRITE to the workspace panel vs just chat?** Operator finds it unclear when content should land in the right-side panel (files/todos/workspace — the 087 surface) vs the chat transcript. Part legibility (make the panel's role obvious), part agent-behavior/prompting (when to use workspace tools) — the behavioral half may predate 094 and need a system-prompt nudge, not just chrome.
- **Completed-step lifecycle in an ongoing thread.** After a workflow completes and the user keeps chatting (Deep) in the SAME thread: how are completed phase steps maintained / updated / hidden, and can a NEW chat message accidentally re-trigger them? 094 SC#1 (completed glyphs) + SC#2 (phasesByThread isolation) cover the rendering; the sketch must explicitly decide the completed-run lifecycle (persist / collapse / hide) + a no-accidental-re-trigger rule. Tie-in: SEED-050 + the `sketch-findings-agentic-rag` panel skill.
- **Context-gathering METHOD for 094 (operator directive 2026-06-02 — capture REAL behaviour, don't theorize).** Before sketch/spec, gather evidence on the 4 seed workflows + the workspace panel across ALL surfaces on ≥2 providers: **UI rendering (Chrome DevTools MCP), backend (uvicorn console), LangSmith traces (phase-by-phase LLM calls + tool use), the code, and live end-to-end runs.** Reason from observed behaviour + response + rendering, not assumptions (the discipline that caught the F8 / asks-the-user defect). Scope is broader than chrome: the workflows' **real purpose, intent, creativity, and design** are in play — *what each workflow should be FOR, how it should behave/feel, what should render when* — so 094 likely warrants a richer evidence-grounded discuss/spec, not just a timeline mockup. Pairs with the lived-experience UAT discipline (`feedback_uat_lived_experience_gap`), `feedback_chrome_mcp_testing`, `reference_evidence_tools_inventory`, and SEED-050 (result quality). **DO NOT start now — runs at 094; keep 093 clean.**

### v2.8 in-flight deferrals

- **SEED-047 (resume ctx missing inputs/model)** — planted 2026-05-31 at 091-08 gap closure (091-REVIEW WR-01/WR-02). Resume context omits run `inputs` (top-level `programmatic` inputs lost on resume → empty splits) and `model`/`user_settings` (resumed `llm_*` phases run with `model=""`). Not fixable in 091 (no `INSERT INTO workflow_runs` in `backend/app`). Deferred to **Phase 092** (dual-mode + Continue owns run creation). Re-open trigger: Phase 092 run-creation persists `workflow_runs.inputs` + `model` → rehydrate into resume ctx; **Phase 096 EVAL-02 (live kill-and-resume)** is the proof gate. Until then, resumed LLM / top-level-input phases are a known live-resume limitation (deterministic unit proof for resume mechanics stands).

### Acknowledged at v2.7 close (2026-05-30)

27 open artifact-audit items acknowledged and deferred at v2.7 milestone close (operator chose "Acknowledge all & proceed"). None block the shipped build — the milestone was verified end-to-end by the Phase 088 cross-cutting capstone.

| Category | Item | Status |
|----------|------|--------|
| UAT gap | 085-HUMAN-UAT.md (5 operator-only scenarios) | Rolled forward — operator-only rows |
| UAT gap | 087-HUMAN-UAT.md (6 operator-only scenarios) | Rolled forward — operator-only rows |
| UAT gap | 083 / 084 / 086 / 087-UAT (0 pending scenarios) | Cosmetic — status fields not flipped |
| Verification | 083-VERIFICATION.md (human_needed) | Accepted — operator UAT approved in-phase |
| Verification | 085-VERIFICATION.md (human_needed) | Accepted — operator UAT approved in-phase |
| Quick tasks | 11 pre-GSD micro-tickets (260322..260412) | Unknown — predate GSD (carried since v2.5) |
| Quick task | 260522-gdg-google-15-iter-loop-diagnostic | Diagnostic note only |
| Quick tasks | 260529-0sc, 260529-1wb | Actually DONE (commits 62c1cf0, c756522) — audit false-positive |
| Dormant seeds | SEED-002 / SEED-003 / SEED-004 / SEED-005 | Dormant — long-deferred future milestones |

Plus v2.7-specific deferrals carried with re-open triggers: **SEED-037** (in-panel office/PDF/PPTX viewing + working download — viewing → v2.9 file_preview plugin; download wire-up → standalone `/gsd:quick` in v2.8), **SEED-038** (chat-vs-panel artifacts unification), **SEED-039** (panel reliability / fast-switch race), **BUG-260527-01** (title-gen live-verify on DeepSeek/Moonshot/Google — folded into 083 but unverified → CF-01 in Phase 089), **BUG-260529-02** (chat-tool-card unification → CHAT-04 / Phase 095).

### Carried forward from v2.6 milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Phase | 082.5 Error Handler Foundation (SEED-026 slice) | Deferred to v2.7+ | v2.6 close |
| Dormant seed | SEED-002 Skill Studio Milestone Preparation | Dormant | v2.5 |
| Dormant seed | SEED-003 Deployment Flexibility & Install/Config UX | Dormant | v2.5 |
| Dormant seed | SEED-004 Org / Department / Role Multi-Tenancy | Dormant | v2.5 |
| Dormant seed | SEED-005 Document Management Capabilities | Dormant | v2.5 |
| Quick tasks | 11 pre-GSD micro-tickets (260322..260412) | Unknown | v2.5 |
| UAT cosmetic | 15 HUMAN-UAT status fields not flipped | Cosmetic only | v2.6 close |
| Verification | 10 verification gaps with project approval | Accepted | v2.6 close |

## Session Continuity

Last session: 2026-06-01 — finished Phase 092.5 Plan 05 (verify + commit Task 3 tests + SUMMARY)
Stopped at: Phase 092.5 Plan 05 complete (Plans 01-05/6 done); next = Plan 06 operator PROOF GATE #2
Resume file: --resume-file

**Plan 092.5-05 — ✅ COMPLETE (2026-06-01):** entangled OpenAI-compat adapter extracted byte-identically (the high-risk Wave-4 step). 3 tasks.

- Task 1 ✅ `provider_gateway/openai_compat.py` (402 lines) — wraps `create_adaptive_streaming_chat`, SURFACES `calling_mode`, OWNS+EMITS the `<think>` machine / `reasoning_content` routing / `_accumulate_chunk_usage` (both branches) / per-provider 5KB boundary dicts (independent); dispatcher's last `NotImplementedError` stub removed. Commit `8635d989`.
- Task 2 ✅ agent_loop OpenAI else-branch dispatches via `await open_stream(...)`; `_on_chunk_openai` folded into the ONE shared consumer `_on_chunk`; `parse_structured_tool_calls` post-parse + STRUCTURED injection + provider-error retry/cap-pause/end_turn/empty-retry/round-trip persistence STAY consumer-side verbatim. Commit `14b75c96`.
- Task 3 ✅ repointed `_accumulate_chunk_usage` import + ~21 `create_adaptive_streaming_chat` monkeypatch targets to the `openai_compat` namespace; flipped `test_provider_gateway_seam` OpenAI groups live (I4/Pitfall-3/I8/Open-Q2). Commit `dfc2c915` (23 test files; scoped to `backend/tests/` — unrelated README deletion excluded).
- Verification (3 independent proofs): seam+chunk_handler **17 passed / 0 skipped**; full-suite **ZERO net-new attributable to Plan 05** — proven via git-worktree A/B vs pre-extraction `4a4bd327` (baseline 99 / current 105; the 6 comm-deltas are flaky live-infra: FK-race + 0.3s perf threshold, return 3-passed/4-skipped on baseline code; `test_077_*` pre-named flaky); **adversarial 6-lens byte-identical review = ZERO breaking deltas** (usage byte-identical diff, consumer-residue zero-diff, `<think>`/reasoning/boundary char-identical, dispatcher routes all 7 compat incl. Ollama, no import cycle). 2 suspicious (non-breaking) deltas → Plan 06 live gate (see Blockers).
- **GATEWAY-01 stays OPEN** (Pending) — closure needs the Plan 06 operator PROOF GATE #2 (final native-7 SSE diff). SUMMARY: 092.5-05-SUMMARY.md. NEXT: Plan 092.5-06 (Wave 5, autonomous:false — operator captures `--mode after` across native-7 + restarts uvicorn first; PASS closes 092.5 → unblocks Phase 093).

**Plan 092-07 — ⏸ Tasks 1-5 DONE (code + tests); Task 6 UAT AWAITING OPERATOR (2026-05-31):** F4 id-routing gap-closure (sub-agent parent_run_id FK + SSE routing + resume/Continue-404). Ran SEQUENTIALLY on the main working tree.

- Task 1 ✅ Facet A — wf_ctx carries producer_run_id=run_id (the producer runs.run_id, FK target for sub-agent parent_run_id); _build_phase_tool_context sources the parent id from producer_run_id FAIL-CLOSED (raises if absent — no silent FK re-trigger for any of the 7 providers); task_service UNCHANGED (Deep byte-identical). Commit fa14a1c3.
- Task 2 ✅ Facet B — run_workflow + _run_phase_with_gates thread a keyword-only stream_run_id; all 9 engine _emits route to run:{producer} (the watched stream); write_audit stays workflow-run-keyed (F1 shape). ask_user_prompt emit (a DIRECT executor emit) routes on the producer transport while the durable prompt-row run_id VALUE + subscribe_for_response channel stay on the workflow_run id. Sibling-escape audit: ask_user_prompt is the only direct executor emit. Commit ca0ee5c5.
- Task 3 ✅ Facet C resume — _build_resume_context + _harness_continuation mint a fresh producer-shell runs row (NON-NULL model/provider='unknown', parent None) + set producer_run_id; the sweep + continuation terminalize the shell on EVERY exit path (try/finally → finalize_run, success/exception) so a crashed resume never re-wedges the thread (F2 self-heal preserved). CONT-01 cap untouched. Commit 0f6a66df.
- Task 4 ✅ Facet C Continue-404 + surfacing — continue_run resolves a post-reload workflow_run id under the caller's ownership (AND user_id + thread-anchor confirm; IDOR preserved — another user's id still 404s); get_thread_workflow surfaces latest_producer_run_id as a PURE additive read (added run_id to the EXISTING F2 self-heal SELECT — no new query, no write); frontend (StreamsProvider + MessageItem + producerResubscribeSignal + api.ts) re-subscribes the fresh producer stream on BOTH paths (the /continue 200 producer_run_id AND the mount/reconcile latest_producer_run_id), per-thread keyed, additive. tsc -b 54 baseline (0 net-new), vite build clean. Commit cdd775f6.
- Task 5 ✅ live-DB FK regression test (tests/integration/test_092_subagent_parent_fk_live.py) — the backstop the mock pool cannot give: a producer parent resolves (end-to-end JOIN), a workflow_run-id parent raises ForeignKeyViolationError, the resume mint produces a valid FK target, the Deep chain is unchanged. 4 green vs PG :54322; SKIPS cleanly when PG down. Commit ec9dd4f4.
- No-regression: backend full-suite ZERO net-new test-node failures vs the 092-03 baseline (the only pre-existing harness failure, test_bounded_retry_reaches_failed_after_3_attempts, persists per 092-05 SUMMARY). Two test-pollution fixes (registry save/restore + producer_run_id on harness-ctx test builders) so the fail-closed guard didn't false-red ordering-dependent tests: commits 69e01300 + 2aa25777.
- Task 6 ⏸ BINDING checkpoint:human-action — the operator runs the 4-axis native-7 UAT (re-runs 092-06 rows 4-10 LIVE). **The operator MUST restart the backend (uvicorn) before the UAT — the F4 fixes are in backend code.** SUMMARY.md (092-07-SUMMARY.md) DEFERRED until the gate resolves. MODE-01/MODE-02/CONT-01 stay OPEN; phase 092 NOT complete until the UAT is GREEN.

**Plan 092-06 — ⚠️ CODE-COMPLETE (Tasks 1-2 shipped); Task 3 UAT gaps_found:** F3 client lock-UX gap-closure. See `092-06-SUMMARY.md` + `092-06-UAT-FINDINGS.md`.

- Task 1 ✅ api.ts ApiError (status-carrying 409) + StreamsProvider: per-thread workflow lock SEEDED at kickoff (Harness send) + SEEDED/CLEARED on the mount-time getThreadWorkflow reconcile (D-v2.5-03; clears on stale/terminal anchor = F2 self-heal). tsc --noEmit clean (commit 3b21f230)
- Task 2 ✅ MessageInput: textarea + Send + canSend now gate on workflowLocked (toggle + selector already did); locked textarea shows the D-05 "Workflow running — Cancel to switch back" hint. StreamsProvider sendMessage catch: a 409 ApiError rolls back BOTH optimistic bubbles (user + orphaned assistant placeholder) and surfaces a fixed per-thread error via the existing reconcileErrors Map (T-092-06-03 — no internals leaked). ChatArea: per-thread banner message-aware — 409 renders fixed lock copy (data-testid=workflow-lock-error-banner, Dismiss only); reconcile-failure keeps cached-version copy + Retry. api.ts ApiError uses an explicit field (not a TS parameter-property) so tsc -b erasableSyntaxOnly accepts it. Verify: tsc -b = exactly 54 baseline (ZERO net-new), vite build clean (commit 4546b5bb)
- All changes per-thread keyed + additive; no provider streaming branch touched (SC#3 / BUG-260523-01 / 075.x cascade rules honored). Deviation: 1 auto-fix (Rule 3 — ApiError explicit class field, erasableSyntaxOnly-safe).
- Task 3 ✅ RESOLVED (orchestrator Chrome MCP + operator live Supabase + uvicorn console) = **gaps_found**. F1 ✅ VERIFIED CLOSED live (workflow_runs + harness_audit non-null user_id, no NotNullViolationError). F2 ✅ VERIFIED CLOSED + SC#2 ✅ PASS (failure path: status='failed' + anchor=NULL, no wedge). F3 ⚠️ code-complete but live-unverified (workflow dies in ~2s, no thread stays locked to observe; composer correctly unlocked for the terminal run = consistent). **NEW blocker F4** (harness sub-agent runs_parent_run_id_fkey — ctx.run_id is the workflow_run id, not a `runs` row) blocks any workflow running end-to-end → SC#3/SC#5/CONT-01/SC#10 native-7/Deep byte-identical all ⛔ BLOCKED. Routed to gap plan **092-07** (out of scope for 092-05/06). Requirements MODE-01/MODE-02/CONT-01 stay OPEN; phase 092 NOT complete.

**Plan 092-05 — ✅ COMPLETE (2026-05-31):** backend gap-closure for the 092-04 UAT.

- Task 1 ✅ migration 064 (workflow_runs.user_id + backfill + FK + index) authored, operator-applied LIVE via SQL editor, full-schema regenerated (commits 160bb729 + 88e05f07)
- Task 2 ✅ F1 — create_workflow_run persists user_id; write_audit keyword-only user_id + 4-col INSERT; all 11 audit sites pass the owner (commit cd592935)
- Task 3 ✅ F2 — _shielded_finalize terminalize-and-clear on harness escape; lock_is_stale producer self-heal (commit 27afae18)
- Task 4 ✅ live-DB harness_audit integration test (closes 091 mock blind spot) — both gates green vs local Postgres (commit c5388ec0)
- Verify: wave gate 28/28 green; full backend suite 103-failed/1014-passed vs 102/1008 baseline = +6 new passing, ZERO net-new failures. Requirements MODE-01/MODE-02/CONT-01 left OPEN (092-06 + phase verification own closure).
- Deviation: 1 auto-fix (Rule 3 — tool_dispatcher._spawn_tool_refused_audit was the 11th write_audit caller, broke on the new keyword-only signature; fixed additively).

**Plan 092-04 — ⏸ IN PROGRESS (Tasks 1-3 done, awaiting Task 4 UAT):**

- Task 1 ✅ api.ts — getThreadWorkflow + continueRun + listPublishedWorkflows + cap_paused SSE callback + workflow_definition_id kickoff field (commit 9fe94d26)
- Task 2 ✅ per-thread keyed workflow-lock state (SC#3 — Map, copy-then-mutate, GC delete-the-key; NO global boolean) + useWorkflowLockForThread selector + onCapPaused SSE populate + terminal clear (commit ca09c90d)
- Task 3 ✅ Deep/Harness toggle (data-testid=workflow-mode-selector) + published-workflow picker + disable-with-tooltip on BOTH selectors while locked (D-03/D-05) + inline Continue card (out-of-band cap_paused, 3-cap) + mount-time getThreadWorkflow reconcile (SC#5/D-v2.5-03) (commit fcb825b5)
- Task 4 ⏸ BLOCKING checkpoint:human-verify — Chrome MCP lived-experience UAT (SC#3 parallel-thread + SC#5 reconcile + SC#2 DB-NULL + CONT-01 Continue + SC#10 native-7 4-axis scoreboard). Operator must run backend uvicorn + frontend dev server. Resume signal: "approved" or describe the failing scenario.
- Verify status: `vite build` PASSES clean; `tsc -b` has 54 PRE-EXISTING baseline errors (0 net new — see deferred-items.md). Frontend Deep chat byte-identical when no workflow active (lock Map empty = no behavioral change).
- SUMMARY (092-04-SUMMARY.md) DEFERRED until the UAT checkpoint resolves. Requirements MODE-01/MODE-02/CONT-01 left OPEN (phase verification owns closure; SDK requirements.mark-complete intentionally skipped).

**Plan 092.5-01 — ✅ COMPLETE (2026-06-01):** gateway package SKELETON (pure new-file authoring; NO agent_loop edit → Deep trivially byte-identical). Ran SEQUENTIALLY on the main working tree.

- Task 1 ✅ `provider_gateway/events.py` — canonical `GatewayEvent` TypedDict union (8 event types, D-02 seam contract). Lossless superset: `code_so_far` (075.6) on `ToolArgsProgressEvent`, `thought_signature` (`NotRequired`) on `ToolStartEvent` + `FinishEvent.tool_calls` (Google I2), `reasoning_delta` first-class. py3.12 → native `typing.NotRequired` (no `typing_extensions`). `__init__.py` package marker. Commit `325a5422`.
- Task 2 ✅ `provider_gateway/dispatcher.py` — `open_stream(provider, request) -> (AsyncIterator[GatewayEvent], CallingMode)` skeleton mirroring `create_adaptive_streaming_chat`'s tuple contract; provider→adapter routing (anthropic/google explicit, OpenAI-compat `else`) matching agent_loop.py:1396/:1530/:1657; adapter bodies = `NotImplementedError` stubs (Waves 2/4 fill). `GatewayRequest` dataclass envelope. `CallingMode` RE-EXPORTED from openai_service (no new enum — Pitfall 3). `__init__.py` exports. Commit `9cdbbd91`.
- Task 3 ✅ `tests/unit/test_provider_gateway_seam.py` — D-08 seam-contract test (RED scaffold). 3 shape tests PASS today (lossless-superset, CallingMode-re-export, routing skeleton); 6 adapter tests SKIP via **function-scope** `importorskip` (anthropic/google Wave 2, openai_compat Wave 4) → RED→GREEN as adapters land. Asserts I4 `<think>`-routing, I2 `thought_signature`, Pitfall-3 `calling_mode` surfacing. `pytest -x -q` → `3 passed, 6 skipped`, exit 0. Commit `2fb4f59e`.
- SC#3 zero import cycle confirmed package-wide (no agent_loop/threads import). Full backend suite: **103 failed (= 092-05 documented baseline) / 1062 passed — ZERO net-new failures** (no agent_loop edit; +3 new shape tests pass; zero `provider_gateway`/`seam` references in the failure set).
- Deviations: 3 auto-fixed — (1, Rule 1) module-level `importorskip` collapsed the whole test file → moved to function scope; (2, Rule 1) wrong `TYPE_CHECKING` import path for `UserEffectiveSettings` → `app.models.user_settings`; (3, Rule 3) added `__all__` to events.py so `grep -c GatewayEvent >= 2`. All within plan intent; no scope creep.
- **GATEWAY-01 stays OPEN** (Pending) — this plan is the SKELETON only; closure requires the adapter waves (02-06) + the operator-run 089 SSE-diff byte-identical gates. `requirements.mark-complete` intentionally skipped.
- SUMMARY: 092.5-01-SUMMARY.md (self-check PASSED). NEXT: Plan 092.5-02 (Wave 1, autonomous:false — operator captures native-7 BEFORE baselines via `scripts/capture_sse_baseline.py --mode before` against the pre-extraction loop; the byte-identical reference for Waves 3/5).

**Planned Phase:** 092.5 (Provider Gateway Extraction) — 6 plans — 2026-06-01T03:44:02.337Z

**Plan 092-01 — ✅ COMPLETE (2026-05-31):** schema foundation landed.

- Task 1 ✅ migration 063_dual_mode_continue.sql — 4 columns + cap_paused on both status CHECKs (commit 35bbfade)
- Task 2 ✅ 3 Wave-0 pytest scaffolds + verify_092.sql; suite exits 0 (3 anchors pass / 12 contracts skipped, owned by Plans 02/03) (commit 2e8106f0)
- Task 3 ✅ operator applied migration 063 LIVE via SQL editor; verify_092.sql confirmed 4 columns + cap_paused (paused preserved on workflow_runs); full-schema.sql regenerated (no reset) — continues_used ×6, cap_paused ×2 on disk (commit e79acec7)
- SUMMARY: 092-01-SUMMARY.md (self-check PASSED). Requirements MODE-01/02/CONT-01 stay OPEN — Plan 01 is schema-only; Plans 02/03/04 wire them.
- Key facts: cap_paused is a NEW non-terminal status distinct from paused; workflow_runs.inputs/model persist kickoff ctx (SEED-047); continues_used on both tables = D-06 Continue cap (max 3/run). Downstream Plans 02/03 flip the skipped contract tests.
