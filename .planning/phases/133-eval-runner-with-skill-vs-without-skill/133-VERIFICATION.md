---
phase: 133-eval-runner-with-skill-vs-without-skill
verified: 2026-06-30T12:00:00Z
status: human_needed
score: 4/4 automatable must-haves verified
overrides_applied: 0
human_verification:
  - test: "Cross-provider live eval run — OpenAI"
    expected: "2-case eval run completes on OpenAI; both WITH and WITHOUT arms produce completions; WITH arm visibly loaded only the target skill in the system prompt (check LangSmith or backend logs)"
    why_human: "Requires live provider keys, real completions, and runtime log inspection"
  - test: "Cross-provider live eval run — Anthropic"
    expected: "Same as OpenAI axis; WITH arm skill catalog = target skill only; WITHOUT arm = no skill note"
    why_human: "Live provider call; runtime verification only"
  - test: "Cross-provider live eval run — Google"
    expected: "Same coverage on Google (Gemini); eval run completes without schema-trap errors"
    why_human: "Live provider call; Google schema trap (type:[] union) must not surface"
  - test: "Cross-provider live eval run — OpenRouter"
    expected: "Eval run completes on an OpenRouter representative model"
    why_human: "Live provider call; OpenRouter is experimental"
  - test: "Multi-tool eval case"
    expected: "A test case whose prompt forces 2+ tools (e.g. search_documents + execute_code) under the WITH arm completes; both tools are visible in the eval result output or LangSmith"
    why_human: "Proves the full agent loop ran multiple iterations, not just a single emission"
  - test: "Parallel-thread isolation"
    expected: "An eval run streaming while a normal Deep chat thread accepts a new prompt — neither buffer corrupts the other; both run_ids produce distinct SSE streams"
    why_human: "Concurrency / buffer-isolation is runtime behavior; can't be verified with static grep"
  - test: "Long-history eval case"
    expected: "An eval with a >=5 KB prompt (or after a long chat thread) completes; history-trim in the eval thread does not crash or produce empty output"
    why_human: "Trim path is runtime + size-dependent; manual per provider"
  - test: "Deep Mode unchanged backstop (live)"
    expected: "A normal Deep chat turn (no eval, skill_catalog_override absent from RunContext) after Plan 02 shipped — catalog injection + streaming are unchanged vs. pre-phase behavior"
    why_human: "Live confirmation the shared path is byte-identical in practice; automated test_deep_mode_unchanged covers the unit-level truth but live UX confirmation is the SC#10 backstop"
---

# Phase 133: Eval Runner — With-Skill vs Without-Skill Verification Report

**Phase Goal:** A user can launch an eval run that executes each saved test case both WITH the target skill active and WITHOUT it, watch per-case progress stream live over SSE, and find the complete result set still readable after a page reload or backend restart. Reuses the existing agent loop + provider gateway (no new runtime); Deep Mode byte-identical.

**Verified:** 2026-06-30
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each test case is executed twice — with-skill and without-skill — producing two comparable completions per case (EVAL-02 / SC#1) | VERIFIED | `eval_runner_service.run_eval_job` loops cases, calls `_run_arm` with `VARIANT_WITH` + `VARIANT_WITHOUT` sequentially; `test_two_results_per_case` drives 2 cases → asserts exactly 4 `eval_results` rows; all pass. |
| 2 | Per-case progress streams live over SSE as the run executes — `eval_case_started`, `eval_case_done`, `eval_complete` event vocabulary; no chat terminal types mid-run (SC#2) | VERIFIED | `eval_runner_service` defines `EVENT_CASE_STARTED/DONE/COMPLETE`, XADDs them to `run:{run_id}`; `_noop` emit is handed to inner `run_agent_loop` preventing terminal leakage; `test_sse_vocabulary` asserts ordered eval_* events + no `done/error` before `eval_complete`; PASS. `api.ts` `StreamCallbacks` gains 3 optional `onEvalCase*` callbacks; `subscribeToRun` gains additive dispatch branches (lines 821–833). |
| 3 | Full result set persists durably and is readable after page reload or backend restart (SC#3) | VERIFIED | `eval_results` table defined in migration 080 with per-arm inserts in `_persist_result` (wrapped in `run_in_threadpool`). GET `/skills/{id}/evals/runs/{run_id}` reads from Postgres directly. `test_results_persist_after_buffer_expiry` asserts 4 results returned when `run:{run_id}` key absent from Redis. `test_reattach_via_runs_row` asserts companion `public.runs` row allows `GET /runs/{run_id}/stream?since=0` replay; both PASS. Frontend `SkillEvalSection` re-fetches `getEvalRun` on `eval_complete` and every terminal. |
| 4 | Eval reuses existing agent loop + provider gateway (no new runtime); `RunContext.skill_catalog_override` defaults to `None` (off); Deep Mode byte-identical (SC#4) | VERIFIED | `RunContext.skill_catalog_override: tuple[dict, ...] \| None = None` at `agent_loop.py:202` — additive default-off field, no existing call-site changed. Single read-site branch at line 1191: `None` path runs the IDENTICAL DB query (proven by `test_deep_mode_unchanged`). `test_with_arm_injects_only_target` + `test_without_arm_injects_nothing` confirm D-03/D-04 behavior. All 8 tests PASS. No new runtime: `eval_runner_service` calls `run_agent_loop` only. |

**Score:** 4/4 automatable must-haves verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/080_eval_runs_and_results.sql` | eval_runs + eval_results tables, RLS, FK traceability | VERIFIED | 124-line migration; `CREATE TABLE public.eval_runs`, `CREATE TABLE public.eval_results`; owner-only SELECT RLS; NO INSERT/UPDATE/DELETE policies; FK to `skill_versions.id` + `skill_test_cases.id` |
| `backend/app/models/eval_run.py` | StartEvalRunBody, EvalRunResponse, EvalResultResponse Pydantic models | VERIFIED | 63 lines; flat single-typed fields (`str \| None`, `int \| None`, `datetime \| None`); no multi-type unions (Gemini trap avoided) |
| `backend/app/services/eval_runner_service.py` | Bounded background job, NO-OP emit, honest A/B, per-arm persist | VERIFIED | 463 lines; `run_eval_job` drives `_run_arm` twice per case; `_noop` supplied as emit/emit_terminal to inner loop; WITH arm sources version snapshot; WITHOUT arm injects `()`; all `supabase-py` calls in `run_in_threadpool`; `finalize_run` in finally block |
| `backend/tests/test_eval_runner.py` | 5 tests covering SC#1/SC#2/SC#3/cross-user-404 | VERIFIED | 609 lines; 5 async tests; _FakeRedis + _FakeSupabase/_FilterSupabase; all 5 PASS |
| `backend/app/api/evals.py` | POST kickoff (202), GET durable readout, GET list; companion runs row; owner 404-not-403 | VERIFIED | 398 lines; POST mints `run_id = eval_runs.id = companion runs.run_id`; `SET NX` inflight claim; `insert_run` for companion row; GET reads Postgres directly; 404-not-403 on all three routes |
| `backend/app/main.py` | `evals.router` imported and mounted | VERIFIED | Line 423: `evals` in import tuple; line 447: `app.include_router(evals.router)` |
| `backend/tests/test_agent_loop_catalog_override.py` | 3 tests — `test_deep_mode_unchanged`, `test_with_arm_injects_only_target`, `test_without_arm_injects_nothing` | VERIFIED | 256 lines; all 3 PASS |
| `backend/app/services/agent_loop.py` (modified) | `RunContext.skill_catalog_override` field + single read-site branch | VERIFIED | Field at line 202 (default `None`); alias at line 1105; read-site branch at lines 1191–1201; count of 4 occurrences as claimed |
| `frontend/src/components/skills/SkillEvalSection.tsx` | Thin eval runner surface — provider/model picker, Run eval, live progress, durable readout | VERIFIED | File exists; imports `startEvalRun`, `getEvalRun`, `listEvalRuns`, `subscribeToRun`; reattach on mount via `listEvalRuns`; `subscribeToRun` with `onEvalCase*` callbacks; no bespoke EventSource |
| `frontend/src/lib/api.ts` (modified) | `startEvalRun`, `getEvalRun`, `listEvalRuns` client fns; `onEvalCaseStarted/Done/Complete` callbacks; `subscribeToRun` dispatch branches | VERIFIED | All 3 fns present (lines 1624, 1649, 1661); callbacks in `StreamCallbacks` (lines 420–422); dispatch branches (lines 821–833) — additive, no `return`, Deep/harness dispatch byte-identical |
| `frontend/src/components/skills/SkillFormDialog.tsx` (modified) | `SkillEvalSection` imported and rendered | VERIFIED | Line 15: import; line 548: `<SkillEvalSection skillId={savedSkillId} />` |
| `frontend/src/types/index.ts` (modified) | `EvalRunKickoff`, `EvalRun`, `EvalResult`, `EvalRunReadout` wire types | VERIFIED | Lines 573–617: all 4 types present; snake_case mirrors migration 080 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `evals.py POST` | `eval_runner_service.run_eval_job` | `asyncio.create_task` | WIRED | Line 287–300 of evals.py; task registered in `RUN_TASKS[run_id]` |
| `run_eval_job` | `run_agent_loop` | `_run_arm` calling `await run_agent_loop(ctx, emit=_noop, ...)` | WIRED | `eval_runner_service.py:285` |
| `eval_runner_service` | `run:{run_id}` Redis buffer | `_emit_eval` → `redis.xadd` | WIRED | Lines 107–122; `eval_case_started`/`eval_case_done`/`eval_complete` |
| `evals.py POST` | `public.runs` companion row | `insert_run(pool, run_id=run_id, ...)` | WIRED | `evals.py:257–265` |
| `GET /runs/{id}/stream` (runs.py) | eval run buffer | companion runs row owner-check | WIRED | `test_reattach_via_runs_row` confirms 200 + buffer replay; PASS |
| `SkillEvalSection` | `startEvalRun` / `getEvalRun` / `listEvalRuns` | `api.ts` client fns | WIRED | Lines 24–27 of SkillEvalSection imports; used in handler and mount effect |
| `subscribeToRun` | `onEvalCaseStarted/Done/Complete` callbacks | dispatch branches | WIRED | `api.ts` lines 821–833; additive, no `return` |
| `SkillFormDialog` | `SkillEvalSection` | import + render | WIRED | Line 15 import, line 548 render |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `SkillEvalSection` | `results` (EvalResult[]) | `getEvalRun` → GET `/skills/{id}/evals/runs/{run_id}` → Postgres `eval_results` table | Yes — DB query with `.eq("eval_run_id")` + `.eq("user_id")` | FLOWING |
| `SkillEvalSection` | `liveStatus` (LiveStatus) | `subscribeToRun` → `onEvalCaseDone` callback → SSE event from `run:{run_id}` buffer | Yes — driven by real XADD events from `eval_runner_service` | FLOWING |
| `SkillEvalSection` | `runs` (EvalRun[]) on mount | `listEvalRuns` → GET `/skills/{id}/evals/runs` → Postgres `eval_runs` table | Yes — owner-scoped DB query | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 133 backend tests (all 8) | `pytest tests/test_eval_runner.py tests/test_agent_loop_catalog_override.py -v` | 8 passed, 0 failed, 5.05s | PASS |
| `evals.router` mounted in `app` | `grep -n "evals" backend/app/main.py` | Lines 423 + 447 confirmed | PASS |
| `RunContext.skill_catalog_override` field exists | `grep "skill_catalog_override" backend/app/services/agent_loop.py` | 4 occurrences (decl + alias + branch) | PASS |

---

### Probe Execution

No explicit probes declared in PLAN or SUMMARY files. Step 7c: SKIPPED (no probe-*.sh scripts for this phase).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EVAL-02 | Plans 01–05 | Eval runner: with-skill vs without-skill, per-case progress, durable results | SATISFIED | 4/4 SC truths verified; 8/8 tests pass; all artifacts exist and are wired |
| SC#10 cross-provider UAT | VALIDATION.md | 4-axis UAT (cross-provider × multi-tool × parallel-thread × long-history) | NEEDS HUMAN | Explicitly manual-only in VALIDATION.md; see Human Verification section |
| SC#4 Deep Mode unchanged | Plan 02, test_deep_mode_unchanged | `RunContext` with override=None produces identical behavior | SATISFIED | `test_deep_mode_unchanged` PASS; single read-site branch verified |
| D-08 owner-scoping | Plan 04 | `.eq("user_id")` on every route; 404-not-403 cross-user | SATISFIED | `test_cross_user_404` PASS; code verified in evals.py |
| D-14 red line | Plan 02 | No new runtime; eval drives agent loop read-only | SATISFIED | `eval_runner_service` calls `run_agent_loop` without modifying it; G-5 hot file untouched by evals.py |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | No debt markers (TBD/FIXME/XXX/TODO/HACK) found in new files | — | — |

No stub indicators found in key new files. The eval runner service, router, and frontend surface all contain substantive implementations with real data flows.

---

### Human Verification Required

The following SC#10 4-axis UAT scenarios require live operator testing. These were authored in VALIDATION.md as explicitly manual-only. They are the only remaining gate before the phase can be marked fully passed.

#### 1. Cross-Provider Eval Run — OpenAI

**Test:** Pick OpenAI (representative model) at launch; run a 2-case eval; confirm both arms complete and the WITH arm's system prompt (visible in LangSmith or backend logs) contains only the target skill.
**Expected:** Both `with_skill` + `without_skill` arms produce completions; WITH system prompt has `## Available Skills` with exactly 1 entry; WITHOUT has none.
**Why human:** Live provider keys + real completions required; runtime log inspection needed.

#### 2. Cross-Provider Eval Run — Anthropic

**Test:** Same as OpenAI axis, using an Anthropic model.
**Expected:** Both arms complete; skill catalog injection behavior identical across providers.
**Why human:** Live provider call; provider-specific adapter path exercised.

#### 3. Cross-Provider Eval Run — Google

**Test:** Same coverage on Google (Gemini representative model).
**Expected:** Eval run completes without schema-trap errors; Gemini does not reject the skill catalog note format.
**Why human:** Gemini multi-type schema trap requires live validation.

#### 4. Cross-Provider Eval Run — OpenRouter

**Test:** Same coverage on an OpenRouter representative model.
**Expected:** Eval run completes.
**Why human:** OpenRouter is experimental; only live run confirms routing.

#### 5. Multi-Tool Eval Case

**Test:** Author a test case whose prompt forces 2+ tools (e.g., `search_documents` + `execute_code`). Run the eval with the WITH arm.
**Expected:** WITH arm completion used both tools (visible in output or LangSmith trace); agent loop ran multiple iterations, not a single pass.
**Why human:** Proves the full loop ran; static tests use mocked `run_agent_loop`.

#### 6. Parallel-Thread Isolation

**Test:** Start an eval run, then immediately send a Deep chat prompt in a second browser tab.
**Expected:** Both streams proceed independently; neither SSE stream shows the other's events; eval buffer key (`run:{eval_run_id}`) and chat buffer key (`run:{chat_run_id}`) are distinct.
**Why human:** Concurrency / Redis buffer isolation is runtime behavior.

#### 7. Long-History Eval Case

**Test:** Run an eval with a test case whose prompt is >=5 KB (or run after a long existing chat thread populates the eval thread's history — which is cleared per-case but the underlying Postgres history could grow).
**Expected:** Both arms complete without error; history-trim path in the eval thread does not crash.
**Why human:** Trim path is size-dependent and runtime-only.

#### 8. Deep Mode Unchanged — Live Backstop

**Test:** After Phase 133 is deployed, run a normal Deep chat turn (no eval). Confirm catalog injection, streaming, and tool behavior are identical to pre-phase behavior.
**Expected:** No regressions in normal Deep chat.
**Why human:** `test_deep_mode_unchanged` covers the unit-level truth; lived experience confirms the shared path is untouched in production.

---

### Gaps Summary

No automatable gaps found. All 4 success criteria have verified implementations and passing tests (8/8). The phase is fully wired end-to-end:

- Migration 080 (`eval_runs` + `eval_results`) — applied and regenerated into `full-schema.sql`
- Pydantic models (`eval_run.py`) — substantive, flat-typed
- Eval runner engine (`eval_runner_service.py`) — drives agent loop twice per case with NO-OP emit, persists per-arm, emits additive `eval_*` vocabulary
- Agent loop override (`RunContext.skill_catalog_override`) — additive default-off, Deep Mode byte-identical at `None`
- Router (`evals.py`) — POST (202 kickoff + companion `runs` row), GET durable readout, GET list; owner-scoped 404-not-403
- `main.py` mount — confirmed
- Frontend (`SkillEvalSection`, `api.ts` fns, `subscribeToRun` dispatch branches, wire types) — all wired

The only remaining gate is the SC#10 4-axis manual UAT listed above. These are explicitly manual per VALIDATION.md and are expected human_needed items, not blockers from the automated perspective.

---

_Verified: 2026-06-30_
_Verifier: Claude (gsd-verifier)_
