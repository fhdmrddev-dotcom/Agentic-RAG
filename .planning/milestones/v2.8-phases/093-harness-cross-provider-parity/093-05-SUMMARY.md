---
phase: 093-harness-cross-provider-parity
plan: 05
subsystem: harness
tags: [surfacing, single-persist-owner, run-workflow, ctx-model, ask-user, draft, resume, continue, cross-provider, sse, harness]

# Dependency graph
requires:
  - phase: 093-01
    provides: "test_093_surfacing.py RED scaffold (3 skipped cases) — the D-11 single-helper contract this plan flips GREEN"
  - phase: 093-03
    provides: "resolve_workflow_ctx_model(user_settings) -> str — the resolve-never-mutate ctx-model wrapper (D-04/D-05) threaded onto the live + resume wf_ctx (build sites 1+2)"
  - phase: 093-04
    provides: "the Continue ctx-model thread (D-04 site 3, owned by 093-04 in runs.py — NO file overlap with this plan's runs.py-free surface) + the load-owner-settings pattern this plan mirrors on resume"
  - phase: 092-07
    provides: "the inline F6/F7 live-kickoff surfacing block (threads.py) this plan HOISTS into the shared helper + the engine terminal (ctx.final_output/final_source_refs/final_citations/final_confidence) the helper reads + the 5 F6/F7 dual_mode_wiring contract tests this plan retargets"
provides:
  - "harness_engine._surface_final_answer — ONE shared surfacing helper invoked on run_workflow's success terminal; the single surfacing site + single persist owner for live + resume + Continue (D-11, Pitfall 5 / Landmine 5)"
  - "Surfacing emits delta + sources/citations/confidence (same canonical vocabulary, 400-char citation-passage truncation) BEFORE the terminal run_completed, then persists the assistant messages row EXACTLY ONCE — resumed/Continue'd workflows no longer lose their answer"
  - "The inline threads.py live-kickoff surfacing block REMOVED (no double-persist / duplicate assistant message); the Deep else branch + run_agent_loop + Deep _result_sink byte-identical (D-14)"
  - "D-04 sites 1 (live-kickoff) + 2 (resume) thread resolve_workflow_ctx_model onto wf_ctx.model (resolve-never-mutate, D-05)"
  - "The ask_user prompt carries the prior-phase draft (D-12) through the durable prompt row + the ask_user_prompt SSE event + the /pending replay + the frontend PendingAsk.draft optional field — all purely additive"
  - "The per-phase event-shape contract fixed for Phase 094 (ask_user_prompt + delta/sources/citations/confidence + run_completed) so 094 renders without re-deriving"
affects: [094-panel-legibility, harness, ask_user-round-trip, resume, continue, PendingAsk]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single surfacing site + single persist owner on the engine terminal (run_workflow) — every entry path that rides run_workflow surfaces identically; no per-entry-path duplicate surfacing"
    - "Emit-before-terminal ordering: durable finish_run UPDATE → surfacing emit + persist → terminal run_completed (mirrors _shielded_finalize / D-v2.5-03)"
    - "Resolve-never-mutate ctx-model threading at the build site (live: request user_settings; resume: cheap in-memory load_user_settings from run[user_id]) — phase.config.model or ctx.model precedence preserved"
    - "Additive draft carry through the existing event vocabulary (durable row + SSE + /pending + PendingAsk) — no new event type; Deep dispatch + Phase 086 role='system' filter untouched"

key-files:
  created:
    - .planning/phases/093-harness-cross-provider-parity/093-05-SUMMARY.md
  modified:
    - backend/app/services/harness_engine.py
    - backend/app/api/threads.py
    - backend/app/services/harness/phase_types.py
    - backend/app/api/panel.py
    - frontend/src/lib/api.ts
    - frontend/src/types/index.ts
    - backend/tests/test_093_surfacing.py
    - backend/tests/test_dual_mode_wiring.py
    - backend/tests/integration/test_085_panel_endpoints.py
    - .planning/phases/093-harness-cross-provider-parity/deferred-items.md

key-decisions:
  - "D-11 single-helper: HOIST the F6/F7 surfacing OUT of the threads.py live-kickoff branch INTO harness_engine._surface_final_answer (invoked on run_workflow's success terminal) — the single surfacing site + single persist owner for live + resume + Continue; the inline block is removed in the same change so there is exactly one persist per path (no duplicate assistant message)"
  - "The helper persists DIRECTLY via insert_assistant_message (resume/Continue have no _result_sink/_shielded_finalize); the live path's _result_sink persist install is dropped — _shielded_finalize no-ops on the absent harness persist"
  - "D-04 site 2 (resume) loads the run OWNER's effective settings from run[user_id] (cheap in-memory load_app_settings cache read — Open Q2 preferred path, mirroring 093-04's Continue site 3) and resolves the ctx model; load-failure falls back to None+'' (phase.config.model still applies) — never blocks resume"
  - "D-12 draft = _latest_phase_text(accumulated_outputs): the latest non-empty {text} upstream output (mirrors _collect_sub_questions' reverse scan) — carried additively to the durable row + SSE + /pending + PendingAsk; the visible render is Phase 094"

patterns-established:
  - "Single surfacing site on the engine terminal: every entry path (live/resume/Continue) that calls run_workflow surfaces identically — no per-path copy, no double-persist"
  - "Emit-before-terminal ordering for the surfaced answer + grounding (delta/sources/citations/confidence all index < run_completed index)"
  - "Per-phase event-shape contract documented at plan-time so the downstream chrome phase (094) renders without re-deriving the vocabulary"

requirements-completed: []  # PARITY-02 stays OPEN — phase verification owns the native-7 × 5-type × 4-workflow LIVE UAT (D-13/SC#6, 093-VALIDATION.md)

# Metrics
duration: ~20min
completed: 2026-06-02
---

# Phase 093 Plan 05: Shared Answer-Surfacing Helper + Live/Resume Ctx-Model + ask_user Draft Carry Summary

**Hoisted the harness F6/F7 answer surfacing (delta + sources/citations/confidence emit + the assistant-message persist) out of the threads.py live-kickoff branch into ONE shared `harness_engine._surface_final_answer` helper invoked on `run_workflow`'s success terminal — the single surfacing site + single persist owner for live + resume + Continue (Pitfall 5 / Landmine 5), emitting before the terminal `run_completed` and persisting exactly once with no duplicate assistant message — then threaded the resolved ctx model onto the live + resume wf_ctx (D-04 sites 1+2) and carried the prior-phase draft through the ask_user durable row + SSE + /pending + the frontend PendingAsk shape (D-12, purely additive).**

## Performance

- **Duration:** ~20 min (2026-06-02 15:03 → 15:23 UTC)
- **Started:** 2026-06-02T15:03:33Z
- **Completed:** 2026-06-02T15:23:32Z
- **Tasks:** 3/3 complete
- **Files modified:** 10 (1 created — this SUMMARY; 9 modified incl. 3 test files + deferred-items)

## Accomplishments

- **One shared surfacing helper on the run_workflow terminal (D-11).** `_surface_final_answer(ctx, run_id, stream_run_id, redis, pool)` reads `ctx.final_output["text"]` + `final_source_refs`/`final_citations`/`final_confidence` (the engine already set them at the completion block), emits `delta` then `sources`/`citations`(passage ≤400)/`confidence` on the producer stream, then persists the assistant `messages` row DIRECTLY — invoked on `run_workflow`'s success terminal AFTER `finish_run` (durable status) and BEFORE the terminal `run_completed`. Live + resume (`_build_resume_context`) + Continue (`_harness_continuation`) all call `run_workflow`, so they surface IDENTICALLY (resumed/Continue'd workflows previously reached `run_workflow` directly and NEVER hit the threads.py block → they lost their answer).
- **Inline surfacing block REMOVED from threads.py — single persist owner.** The `_wf_final_text`/`_wf_source_refs` reads, the `_harness_emit` delta/sources/citations/confidence emits, the `_persist_harness_message` closure, and the `_result_sink["persist"] = ...` install are all gone. `_shielded_finalize` reads `_result_sink.get("persist")` and is a no-op when absent → exactly ONE persisted assistant message per path, no double-persist / duplicate (the 075.x defect). The Deep `else` branch + `run_agent_loop` + the Deep `_result_sink` flow are byte-identical (D-14).
- **D-04 sites 1+2 ctx-model threading.** Live-kickoff wf_ctx: `model=resolve_workflow_ctx_model(user_settings)`. Resume `_build_resume_context`: loads the run owner's effective settings from `run["user_id"]` (cheap in-memory cache read; Open Q2 preferred path) and sets `user_settings` + `model`. Resolve-never-mutate (D-05) — no settings UPDATE on either path.
- **D-12 draft carry (additive).** `_latest_phase_text(accumulated_outputs)` → `draft` into the durable ask_user prompt row + the `ask_user_prompt` SSE emit + the `/pending` replay (panel.py) + the frontend `PendingAsk.draft` optional field + the api.ts `ask_user_prompt` dispatch. The per-phase event-shape contract is fixed for Phase 094.

## Single-Persist-Owner Proof (T-093-DOUBLE / Pitfall 5 / Landmine 5)

The highest-risk part of the plan. The proof is in `test_093_surfacing.py` (GREEN, 4 cases):

| Assertion | How proven |
|-----------|-----------|
| Each grounding event emits EXACTLY ONCE | `test_grounding_events_emitted_exactly_once` — drives the helper; asserts `events.count(ev) == 1` for delta/sources/citations/confidence |
| The assistant message persists EXACTLY ONCE | same test — `_persist_call_count(pool) == 1` (counts `INSERT INTO messages ... RETURNING` calls on the mock pool) |
| All grounding emits land BEFORE run_completed | `test_grounding_emitted_before_run_completed` — drives the full `run_workflow` terminal; asserts every grounding index < `run_completed` index, `run_completed` is LAST, and no event double-emitted |
| All 3 paths reach the SAME single helper | `test_resume_and_continue_paths_surface_identically` — spies on `_surface_final_answer`; asserts `run_workflow` invokes it exactly once on its terminal (so every entry path riding run_workflow surfaces identically) |
| Empty answer → no persist | `test_no_text_means_no_persist` — no `delta`, `msg_id is None`, zero INSERTs |

The inline removal is grep-proven and additionally pinned by `test_deep_path_does_not_install_harness_persist_in_source` (retargeted): `_persist_harness_message` count in threads.py == 0, `_wf_final_text` == 0; `_surface_final_answer` present in harness_engine + invoked (count ≥ 2); Deep `result_sink=_result_sink` still present.

## Emit-Before-Terminal Ordering + D-04 Sites + Phase 086 Filter (verification_required confirmations)

- **Inline block removed (not duplicated):** `grep _persist_harness_message backend/app/api/threads.py` == 0; `grep _wf_final_text` == 0. The single helper is the only persist site.
- **Emit-before-terminal:** `_surface_final_answer` is called between `finish_run(pool, run_id, "completed")` and `await _emit(redis, stream_run_id, "run_completed", ...)` in `run_workflow` — proven by `test_grounding_emitted_before_run_completed` (run_completed is the LAST emit, all grounding before it).
- **D-04 sites 1+2:** `grep resolve_workflow_ctx_model backend/app/api/threads.py` == 2 (import + live-kickoff call); `grep ... backend/app/services/harness_engine.py` == 2 (import + resume call). No settings `.update(`/`override_provider`/`.upsert(` added on either changed span (D-05 confirmed).
- **Phase 086 invariant untouched:** the only panel.py change is the additive `draft` field in the `/pending` result payload — the `role='system'` filter in the snapshot/pending query is unchanged (the helper persists an `assistant` row, which does not appear in the `role='system'` ask_user pending filter).

## Frontend Build Evidence

- **tsc:** `cd frontend && npx tsc -b --force` → **54 errors** = exactly the documented baseline, ZERO net-new from the additive `PendingAsk.draft` field + the api.ts dispatch addition.
- **vite build:** `npx vite build` → `✓ built in 2.21s` clean (only the pre-existing chunk-size + INEFFECTIVE_DYNAMIC_IMPORT warnings — no errors).
- **PendingAskCard:** `vitest run PendingAskCard.test.tsx` → 13/13 passed (the additive optional field does not perturb the existing card).

## Per-Phase Event-Shape Contract (D-12 — fixed for Phase 094)

```
phase_started     { phase, phase_index }                                   # engine (already)
phase_completed   { phase, phase_index }                                   # engine (already)
phase_transition  { from_phase, to_phase }                                 # engine (already)
ask_user_prompt   { tool_call_id, prompt, options, timeout_seconds, draft }# D-12 ADD draft
delta             { content }                                              # surfacing helper (D-11)
sources           { sources: [...] }                                       # surfacing helper (F7)
citations         { citations: [{ document_id, chunk_index, passage(<=400), ... }] }
confidence        { level, avg_similarity, disclaimer }
run_completed     { status }                                               # engine (LAST)
```

## Task Commits

1. **Task 1: Shared surfacing helper + inline removal + GREEN test** - `7ab35c83` (feat)
2. **Task 2: Thread resolved ctx model onto live + resume wf_ctx (D-04 sites 1+2)** - `5b03a861` (feat)
3. **Task 3: ask_user draft carry (D-12) + retarget surfacing contract tests** - `02c71c54` (feat)

_Plan metadata commit follows (docs: complete 093-05 plan)._

## Files Created/Modified

- `backend/app/services/harness_engine.py` - Added `_surface_final_answer` (the shared helper) + invoke it on `run_workflow`'s success terminal (emit + persist before `run_completed`); `_build_resume_context` loads owner settings + threads `model=resolve_workflow_ctx_model(...)` (D-04 site 2).
- `backend/app/api/threads.py` - REMOVED the inline live-kickoff surfacing block (emit half + `_persist_harness_message` + `_result_sink` install); ADDED `model=resolve_workflow_ctx_model(user_settings)` to the live wf_ctx (D-04 site 1).
- `backend/app/services/harness/phase_types.py` - `_latest_phase_text` helper + `draft` carried into the durable ask_user prompt row + the `ask_user_prompt` SSE emit (D-12).
- `backend/app/api/panel.py` - `/pending` replay payload carries `draft` (defensive `.get` → None on older rows).
- `frontend/src/types/index.ts` - `PendingAsk.draft?: string` (additive optional field).
- `frontend/src/lib/api.ts` - `ask_user_prompt` SSE dispatch parses `draft` into the PendingAsk (additive; Deep delta/sources/confidence dispatch untouched).
- `backend/tests/test_093_surfacing.py` - Flipped GREEN (4 cases): single-emit + ordering + single-persist + no-text-no-persist.
- `backend/tests/test_dual_mode_wiring.py` - 5 F6/F7 092-07 contract tests retargeted to the shared helper (Rule 1 — caused by the relocation).
- `backend/tests/integration/test_085_panel_endpoints.py` - `/pending` key-set assertion updated for the additive `draft` (Rule 1).
- `.planning/phases/093-harness-cross-provider-parity/deferred-items.md` - logged the pre-existing harness-registry test-ordering pollution.

## Decisions Made

- **D-11 cleanest shape:** the shared helper lives in `harness_engine.py` and is invoked by `run_workflow` itself (not by each caller), so live/resume/Continue cannot diverge — there is structurally ONE surfacing site.
- **Persist directly in the helper, not via `_result_sink`:** resume/Continue have no `_result_sink`/`_shielded_finalize`, so the helper owns the persist for all three paths; the live path drops its `_result_sink` persist install so `_shielded_finalize` is a no-op for harness (the proven-empty-sink path).
- **Resume loads owner settings (Open Q2 prefer-load):** `load_user_settings` → `load_app_settings()` is a pure in-memory cache read (no blocking DB I/O), so it is cheap on the startup sweep; load-failure falls back to `None`+`""` (phase.config.model applies) and never blocks resume — mirrors 093-04's Continue site 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retargeted the 5 F6/F7 dual_mode_wiring contract tests to the shared helper**
- **Found during:** Task 1 (regression sweep after the surfacing relocation)
- **Issue:** `test_dual_mode_wiring.py`'s 5 F6/F7 (092-07) contract tests STUB `run_workflow` and assert the OLD inline threads.py surfacing fires (persist via `_result_sink`, `getattr(wf_ctx, "final_output"` in the branch source, emits inline). Hoisting the surfacing into `run_workflow`'s helper (which they stub out) makes those assertions fail by design — the contract MOVED.
- **Fix:** each stub now mirrors `run_workflow`'s terminal (set `ctx.final_*` THEN call the real `_he._surface_final_answer`); patched the persist target to `app.db.runs.insert_assistant_message` (the helper's lazy import) instead of `app.api.threads.insert_assistant_message`; dropped the obsolete `_result_sink` expectation; the source-grep guard now asserts the NEW structure (helper in harness_engine reads `ctx.final_output`, the inline `_persist_harness_message` is GONE from threads.py, Deep `result_sink` intact).
- **Files modified:** `backend/tests/test_dual_mode_wiring.py`
- **Verification:** 56 passed (the 5 + the surfacing test + the rest of the file).
- **Committed in:** `02c71c54` (Task 3)

**2. [Rule 1 - Bug] Updated the 085 /pending key-set assertion for the additive draft**
- **Found during:** Task 3 (panel test sweep)
- **Issue:** `test_get_pending_ask_user_extracts_payload_from_tool_calls` asserts the EXACT set of `/pending` payload keys, which now includes the additive `draft` (D-12).
- **Fix:** added `"draft"` to the expected key set + asserted `row["draft"] is None` (the seed row has no upstream draft → `payload.get("draft")` is None, harmless/additive).
- **Files modified:** `backend/tests/integration/test_085_panel_endpoints.py`
- **Verification:** 14 panel tests passed.
- **Committed in:** `02c71c54` (Task 3)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — test maintenance directly caused by the D-11 surfacing relocation + the D-12 additive field). No production-code deviations; both keep contract tests valid against the new single-helper architecture.
**Impact on plan:** No scope creep. The behavioral contracts are preserved (and strengthened — `test_093_surfacing.py` is the new authoritative single-persist-owner pin).

## Issues Encountered

- **Test stub used the registry, not `_execute_phase`:** the first GREEN attempt of `test_grounding_emitted_before_run_completed` showed only `delta` (no grounding) because overriding `PHASE_TYPE_REGISTRY["llm_single"]` didn't hold — the real Plan-03 executor ran (and would make a live provider call). Fixed by monkeypatching `harness_engine._execute_phase` (registry-independent) so the stub output is deterministic and the engine accumulates the grounding.
- **Pre-existing harness-registry test-ordering pollution (NOT a regression):** `test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts` (and, in some orderings, `test_phase_dispatch_routes_each_of_5_types`) fail when run after the gate/resume tests that override `PHASE_TYPE_REGISTRY`. Confirmed PRE-EXISTING by stashing ALL 093-05 edits and re-running the same set — both failures reproduce identically on baseline (`a7828abb`); `test_bounded_retry...` also fails in isolation on baseline. Net-new failures from this plan = 0. Logged to `deferred-items.md`.

## User Setup Required

None - no external service configuration required. (No migration; the draft carry rides existing tables/events.)

## Next Phase Readiness

- **Phase 093 all 5 plans executed.** NEXT = `/gsd:verify-work 093` — the verifier owns the native-7 × 5-phase-type × 4-workflow LIVE UAT (D-13/SC#6, authored in `093-VALIDATION.md`), the 2 carry-forward live re-checks (tool_call_id round-trip + token totals), and the Deep-parity regression row. PARITY-02 stays OPEN until then.
- **Phase 094 (Workflow Legibility) is unblocked on the events:** the per-phase event-shape contract is fixed and the surfacing now fires on all 3 entry paths, so 094 can render the chrome without re-deriving the vocabulary or re-wiring the surfacing.
- **Concern:** the surfacing path is exercised by unit + contract tests (mock redis/pool); the resume/Continue answer-surfacing is verified structurally (the single-helper invocation) — the LIVE kill-and-resume model proof is Phase 096 EVAL-02 (deterministic resume mechanics already stand).

## Self-Check: PASSED

- Created/modified files verified on disk: `093-05-SUMMARY.md` (created); `harness_engine.py`, `threads.py`, `phase_types.py`, `panel.py`, `api.ts`, `types/index.ts`, `test_093_surfacing.py`, `test_dual_mode_wiring.py`, `test_085_panel_endpoints.py` (modified) — all FOUND.
- Commits verified in git log: `7ab35c83` (Task 1), `5b03a861` (Task 2), `02c71c54` (Task 3) — all FOUND.

---
*Phase: 093-harness-cross-provider-parity*
*Completed: 2026-06-02*
