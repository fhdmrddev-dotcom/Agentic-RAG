---
phase: 096-eval-harness-cross-provider-verification-concurrency
verified: 2026-06-07T10:15:00Z
status: human_needed
score: 9/12 must-haves verified
overrides_applied: 0
gaps:
  - truth: "restart_smoke single_completion_audit PASS on every healthy run"
    status: failed
    reason: "WR-01 (096-REVIEW): _SQL_DOUBLE_COMPLETION in restart_smoke.py does not normalize the double-encoded harness_audit.metadata jsonb — metadata->>'phase' returns NULL for all 386/386 live audit rows (jsonb strings, not objects), so HAVING count(*)>1 groups all phase_completed rows under a NULL slug, returning a false FAIL on every healthy run. The fix (CASE WHEN jsonb_typeof(metadata)='string' THEN (metadata #>> '{}')::jsonb ELSE metadata END as wrapper) is documented in the REVIEW but was not applied before commit."
    artifacts:
      - path: "scripts/restart_smoke.py"
        issue: "_SQL_DOUBLE_COMPLETION at line 126-130 lacks the jsonb double-decode normalization; eval_cross_provider.py applied the same fix but restart_smoke.py was not updated"
    missing:
      - "Apply the CASE WHEN jsonb_typeof normalization to _SQL_DOUBLE_COMPLETION in restart_smoke.py (the exact fix is in 096-REVIEW.md WR-01)"
  - truth: "Resume sweep handles a missing/corrupt definition without aborting all remaining stranded runs"
    status: failed
    reason: "WR-02 (096-REVIEW): resume_stranded_workflows (harness_engine.py:1250) calls _load_run_definition then passes definition to _resume_run without a None guard. _load_run_definition returns None when the definition row is absent; _resume_run then raises AttributeError on definition.phases, re-raised by the sweep's 'except Exception: raise', aborting every subsequent stranded run in the same sweep. A deleted or corrupt definition is a permanent poison-pill across all process restarts."
    artifacts:
      - path: "backend/app/services/harness_engine.py"
        issue: "Line 1250: definition = await _load_run_definition(pool, run_id) followed immediately by ctx = await _build_resume_context(...) with no None check — verified by reading the code"
    missing:
      - "Add 'if definition is None: logger.warning(...); continue' guard between _load_run_definition and _build_resume_context in resume_stranded_workflows (exact fix in 096-REVIEW.md WR-02)"
human_verification:
  - test: "Live cross-provider eval — native-7 workflow pass"
    expected: "All 7 native providers (openai, anthropic, google, deepseek, moonshot, zhipu, minimax) produce EVAL_ROW PASS with workflow_completed, locked phase sequence, single phase_completed audit per phase, search_documents round-trip, and ask_user auto-answered. Capability table emitted to .planning/eval/capability-table-<date>.{json,md}"
    why_human: "Provider keys are localhost-only by design (D-01); live LLM calls are costly and network-dependent; dry-run for openai-only was validated live (PASS, 54.5s) but the full native-7 matrix requires the operator"
  - test: "Restart smoke — 3 kill points (mid-programmatic, mid-llm_agent, mid-ask_user)"
    expected: "Each kill point: SMOKE_KILL banner prints when target phase is active, operator kills uvicorn, SMOKE_UP detected, all SMOKE_ASSERT lines print PASS (no_skipped_phases, single_completion_audit, no_duplicate_subagents; plus prompt_reemitted and answer_reached_engine for ask_user leg). NOTE: WR-01 must be fixed BEFORE running the smoke — the current _SQL_DOUBLE_COMPLETION will false-FAIL single_completion_audit on every healthy run"
    why_human: "The human IS the restart mechanism — the script deliberately never manages the uvicorn process (D-08 design); live kill/restart cannot be automated"
  - test: "4-axis UAT scoreboard (EVAL-02 / SC#10 recipe)"
    expected: "Cross-provider: all 7 EVAL_ROW PASS (covered by Section A). Multi-tool: at least 1 run with search_documents + execute_code on 2 providers, both tools invoked (DB cross-check), run completes. Parallel-thread: Thread A streaming while Thread B accepts a new prompt — B not blocked, both complete, no cross-thread bleed. Parallel-thread stream-cap SC#5: seed >=6 concurrent active runs, every thread-switch reconciles <1s, max 3 held-open streams visible in Network tab. D-11a: capped-out background threads show running pulse (status-derived) but NO live token progress until visited. Long-message: >=50 prior messages OR >=5KB prompt on >=2 providers, stream completes, no truncation/stall"
    why_human: "Visual behavior (panel rendering, timer honesty, expired card state), real-time measurement (sub-second thread-switch stopwatch), and the parallel-thread/long-message axes require a live human operator with browser DevTools"
  - test: "Concurrency measurements — N=10 fan-out probe (CONC-01 / SC#3)"
    expected: "PROBE_ASSERT fanout_bounded PASS (max interval overlap <=5, total sub-runs ==10), PROBE_ASSERT cross_tab_latency PASS (p95 <50ms on both snapshot and list endpoints), PROBE_BUDGET total=<n> peak_borrowed=<n> recorded and documented"
    expected_note: "Also verifies via the operator-visual check: the ask_user card visually renders expired/disabled for a dead run and shows 'This prompt has expired — the run is no longer active' on a forced 404 submit"
    why_human: "Live load against the real harness engine required; conc_probe.py is the measurement tool but needs the backend running with the real Redis + Supabase stack"
---

# Phase 096: Eval Harness + Cross-Provider Verification + Concurrency Verification Report

**Phase Goal:** The harness is proven trustworthy across all 6 native providers, survives restarts mid-workflow, and batch phases don't starve the app — wired as a standing CI regression gate so future work can't silently break it.
**Verified:** 2026-06-07T10:15:00Z
**Status:** human_needed (2 structural gaps in operator scripts + 4 live measurement items requiring human execution)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | A published global `eval_coverage` workflow exists in the live local DB touching all 5 phase types | VERIFIED | Migration 066 applied via SQL editor; psycopg2 assert returned `('eval_coverage', 'published', True, 5)`; file exists at `supabase/migrations/066_eval_coverage_seed.sql` with `eval_coverage` (6 matches) and uuid `0000000000c1` (1 match) |
| 2 | `eval_slow_step` is registered in the closed PROGRAMMATIC_PHASE_REGISTRY with a ~20s kill window | VERIFIED | `grep -n "eval_slow_step"` in `programmatic.py` shows lines 42/123/124/125/128/129/136; import asyncio present; EVAL_SLOW_STEP_SECONDS=20 |
| 3 | Every push to backend/** runs a deterministic CI structural regression — fake provider at open_stream seam, real engine | VERIFIED | `test_096_ci_workflow_regression.py` (853 lines, 4 tests, 4 passed in 1.10s); patch.object(task_service, "open_stream") appears 8 times; zero executor-seam mocks; `git diff .github/workflows/` is empty (zero YAML edits) |
| 4 | A structural break in phase sequencing, gate retry, whitelist enforcement, or resume 2-phase writes turns CI red | VERIFIED | 4 tests verified: happy_path (5 phases, 2-phase writes), gate_retry_bounded, whitelist_refusal (real dispatch_tool guard), resume_two_phase_writes; all 4 passed locally; Production fix: task_service propagates phase_whitelist to sub_ctx (the D-05 backstop was dead — now live) |
| 5 | A run reaching terminal status leaves NO pending ask_user prompt behind — expiry write at all 4 terminal sites | VERIFIED | `grep -c "_expire_pending_ask_user" harness_engine.py` = 5 (1 def + 4 call sites); `grep -c '"expired"' harness_engine.py` = 1; no UPDATE statements added (INSERT-only); `git diff runs.py threads.py` = empty |
| 6 | GET /panel/{thread}/pending never returns a prompt whose run is dead — both ID namespaces, legacy fail-open | VERIFIED | `active_workflow_run_id` appears 3x in panel.py; `streaming` appears 3x; `_verify_thread_ownership` count unchanged (still first); 13 mock-pool behavior tests all pass (13 passed in 0.49s) |
| 7 | A 404 on ask_user submit surfaces a visible expired state — never silence | VERIFIED | `instanceof ApiError` in PendingAskCard.tsx = 1; "This prompt has expired" = 1; `dangerouslySetInnerHTML` = 0; `created_at` = 7; api.ts line 989: `throw new ApiError("Failed to submit ask_user answer", res.status)`; 28 frontend tests pass (23/23 PendingAskCard + 5/5 streamPool) |
| 8 | At most 3 held-open streaming fetches — LRU-3 pool with symmetric eviction and retained replay cursors | VERIFIED | `STREAM_POOL_SIZE = 3` = 1; `enforceStreamPool` = 2; `isThreadInStreamPool` = 6 (def + 5 gated sites); `lastSeenOffsetRef.current.delete` = 0 in evictor; streamPool.test.tsx 450 lines, 5/5 pass; backend diff = empty |
| 9 | One command drives the eval_coverage workflow end-to-end per provider with DB-truth assertions and robot-answered ask_user | VERIFIED | `--workflow` in eval_cross_provider.py = 12 matches; `eval_coverage` = 13; `terminal_before_answer` = 3; `MANDATORY GATE` = 1; py_compile OK; live dry-run (openai): EVAL_ROW workflow openai gpt-4o PASS PASS PASS PASS PASS 0 54.5 completed PASS |
| 10 | D-04 capability table emitted as versioned JSON+MD per full run | VERIFIED | `capability-table` in eval_cross_provider.py = 12; `.planning/eval/README.md` exists with 2 `capability-table` matches; emitter wired to `--workflow` full runs only (partial runs do not clobber) |
| 11 | restart_smoke.py and conc_probe.py compile and produce correct help/structure | VERIFIED | Both py_compile OK; restart_smoke --help shows `--kill-at {programmatic,llm_agent,ask_user}`; 12 SMOKE markers; 8 PROBE markers; `anyio_threadpool_depth` = 4; semicolon count = 9 (10 clauses); assert_localhost_only first in main() for both; not in backend/ |
| 12 | `restart_smoke single_completion_audit` passes on every healthy run (no false-FAIL from double-encoded jsonb) | FAILED | WR-01: _SQL_DOUBLE_COMPLETION (lines 126-130) uses `metadata->>'phase'` directly — confirmed no CASE WHEN normalization in the file; the same audit rows that made eval_cross_provider.py fail (DI-096-06-A: 386/386 rows are jsonb strings) will make restart_smoke group all phase_completed rows under NULL slug → HAVING count(*)>1 → single_completion_audit false-FAIL on every healthy run |

**Score:** 9/12 truths verified — 2 truths directly failed (truths 12 and the resume-None guard in harness_engine which is a structural concern for any live restart smoke run); plus 4 truths require human execution to confirm

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `supabase/migrations/066_eval_coverage_seed.sql` | eval_coverage 5-type seed workflow | VERIFIED | Exists; 6 eval_coverage matches; uuid 0000000000c1; phase order verified by JSONB parse per 01-SUMMARY |
| `backend/app/services/harness/programmatic.py` | eval_slow_step in closed registry | VERIFIED | eval_slow_step registered at line 128; asyncio.sleep(20); delegates to split_topic; in __all__ |
| `backend/tests/test_096_ci_workflow_regression.py` | 4-test CI structural gate (≥150 lines) | VERIFIED | 853 lines; 4 tests; 4 passed in 1.10s; offline (no provider keys) |
| `backend/tests/test_096_askuser_cleanup.py` | cleanup + dual-namespace filter tests (≥80 lines) | VERIFIED | 478 lines; 13 tests; 13 passed in 0.49s |
| `backend/app/services/harness_engine.py` | _expire_pending_ask_user at 4 terminal sites | VERIFIED | grep count = 5 (1 def + 4 calls); INSERT-only; try/except wrapped |
| `backend/app/api/panel.py` | /pending liveness filter, dual namespace | VERIFIED | _prompt_run_is_live present; active_workflow_run_id + streaming references confirmed |
| `frontend/src/lib/api.ts` | answerAskUser throws ApiError with status | VERIFIED | Line 989: `throw new ApiError("Failed to submit ask_user answer", res.status)` |
| `frontend/src/components/panel/PendingAskCard.tsx` | 404-honesty branch + created_at countdown | VERIFIED | instanceof ApiError = 1; expired message = 1; dangerouslySetInnerHTML = 0; created_at = 7 |
| `frontend/src/__tests__/providers/streamPool.test.tsx` | Pool enforcement / eviction / reattach / PANEL-06 (≥100 lines) | VERIFIED | 450 lines; 5 tests; 5/5 pass |
| `frontend/src/providers/StreamsProvider.tsx` | STREAM_POOL_SIZE=3 LRU pool | VERIFIED | STREAM_POOL_SIZE=3 = 1; enforceStreamPool = 2; isThreadInStreamPool = 6; no cursor eviction |
| `scripts/eval_cross_provider.py` | --workflow row type + ask_user auto-answer + capability-table | VERIFIED | --workflow = 12; eval_coverage = 13; terminal_before_answer = 3; py_compile OK |
| `.planning/eval/README.md` | Capability-table artifact format + operator gate docs | VERIFIED | Exists; capability-table = 2 |
| `scripts/restart_smoke.py` | D-08 operator-driven restart smoke (3 kill points) | PARTIAL | Compiles; --kill-at present; SMOKE markers = 12; assert_localhost_only first; HAVING count present; BUT: _SQL_DOUBLE_COMPLETION lacks jsonb normalization (WR-01) → will false-FAIL on every healthy run |
| `scripts/conc_probe.py` | N=10 fan-out overlap + latency + backpressure probe | VERIFIED | Compiles; PROBE markers = 8; anyio_threadpool_depth = 4; 9 semicolons (10 clauses); both endpoints present |
| `scripts/curate_models.py` | Live /models fetch + 4-target names-only diff | VERIFIED | Exists; 18 CURATE_ marker matches (all 5 types); 8 provider hosts present; py_compile OK |
| `backend/app/config.py` | Curated registry with dated provenance | VERIFIED | 27 matches for "2026-06-07"; api.moonshot.cn = 0 (fixed); claude-opus-4-8/MiniMax-M3/gpt-5.5-pro all registered; CURATE_STALE = 0 post-apply |
| `backend/app/services/task_service.py` | phase_whitelist propagated to sub_ctx | VERIFIED | Production fix shipped in Plan 02; test_096_whitelist_refusal confirms real dispatch_tool guard is live on harness path |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| test_096_ci_workflow_regression.py | task_service.open_stream | patch.object at consumed seam | WIRED | patch.object(task_service, "open_stream") appears 8 times; executor seam (run_task_sub_agent, _stream_one_iteration) never patched |
| test_096_ci_workflow_regression.py | harness_engine.resume_stranded_workflows | resume leg (interrupted between mark_phase_active and complete_phase) | WIRED | resume_stranded_workflows appears 2 times in test file; test_096_resume_two_phase_writes verifies 2-phase-write order |
| harness_engine.py terminal sites | panel.py /pending NOT EXISTS correlation | expiry row shaped as kind=ask_user_response with matching tool_call_id | WIRED | INSERT-only expiry row shape confirmed; 5 call sites confirmed; the existing /pending query's NOT EXISTS correlation excludes the expiry row by design |
| eval_cross_provider.py | workflow_definitions.slug = 'eval_coverage' | runtime slug lookup (SELECT WHERE slug=%s, never hardcoded uuid) | WIRED | eval_coverage = 13 in script; grep for uuid 0000000000c1 = 0 in script |
| eval_cross_provider.py | POST /runs/{workflow_run_id}/ask_user_response | D-02a robot answer via the panel's own endpoint | WIRED | ask_user_response in eval script; terminal_before_answer diagnostic guards the race |
| restart_smoke.py | workflow_definitions slug eval_coverage | seed kickoff with workflow_definition_id via slug lookup | WIRED | eval_coverage present in script; runtime JSONB phase-slug resolution verified live |
| conc_probe.py | GET /admin/backpressure | anyio_threadpool_depth borrowed/total sampling | WIRED | anyio_threadpool_depth = 4 in script; /admin/backpressure present |
| PendingAskCard.tsx | api.ts ApiError | err instanceof ApiError && err.status === 404 | WIRED | instanceof ApiError = 1 in PendingAskCard.tsx; ApiError throw at api.ts:989 confirmed |
| StreamsProvider.tsx enforceStreamPool | subscriptionsRef + subscriptionsByThread | abort + remove-pair at setViewingThread, after reconcile fires | WIRED | enforceStreamPool = 2 (def + call site); lastSeenOffsetRef never deleted; bookkeeping remove-pair confirmed in SUMMARY |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| PendingAskCard.tsx | `remaining` countdown | `ask.created_at` or `timeout_seconds` | Yes — derived from real panel.py /pending payload (owner-scoped, RLS-postured) | FLOWING |
| PendingAskCard.tsx | `state` (expired on 404) | `ApiError.status === 404` from live answerAskUser POST | Yes — real HTTP status from backend's IDOR-safe response | FLOWING |
| StreamsProvider.tsx | `subscriptionsRef` / `mruThreadsRef` | Active run subscriptions + thread navigation events | Yes — live subscribeToRun connections; eviction on setViewingThread | FLOWING |
| eval_cross_provider.py | `model_effective` | `SELECT DISTINCT model FROM runs WHERE parent_run_id IS NOT NULL` | Yes — sub-agent runs.model rows from live DB; proven live (gpt-4o for openai, not the requested column) | FLOWING |
| restart_smoke.py | `assert_single_completion_audit` | `_SQL_DOUBLE_COMPLETION` query against harness_audit | No — returns false-FAIL because metadata->>'phase' returns NULL on double-encoded jsonb (WR-01) | STATIC (incorrect) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---------|---------|--------|--------|
| CI regression test suite (4 tests, all structural legs) | `pytest tests/test_096_ci_workflow_regression.py -q` | 4 passed in 1.10s | PASS |
| ask_user cleanup tests (13 tests, all cleanup + filter behaviors) | `pytest tests/test_096_askuser_cleanup.py -q` | 13 passed in 0.49s | PASS |
| Frontend PendingAskCard tests (23 tests) + streamPool tests (5 tests) | `npx vitest run src/components/panel/__tests__/PendingAskCard.test.tsx src/__tests__/providers/streamPool.test.tsx` | 28 passed in 3.65s | PASS |
| All 4 new operator scripts compile | `py_compile scripts/eval_cross_provider.py restart_smoke.py conc_probe.py curate_models.py` | All 4 OK | PASS |
| eval_cross_provider.py --help shows --workflow | `scripts/eval_cross_provider.py --help` | --workflow present | PASS |
| restart_smoke.py --help shows --kill-at choices | `scripts/restart_smoke.py --help` | --kill-at {programmatic,llm_agent,ask_user} | PASS |
| config.py curated registry imports clean | `python -c "from app.config import MODEL_CAPABILITIES, _SUB_AGENT_MODEL_DEFAULTS"` | 55 capability rows, 9 defaults — PASS | PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| EVAL-01 | Cross-provider eval runs multi-phase workflow on all 6 native providers, asserts locked phase sequence with correct tool round-trips; wired as CI regression gate; model list curation pass | PARTIAL — automated half VERIFIED; live half NEEDS HUMAN | CI gate: 4 tests pass (Plan 02); eval_cross_provider.py --workflow implemented with all assertions and DB-truth polling (Plan 06); curate_models.py ran live + config.py curated with CURATE_STALE=0 (Plan 08); MISSING: full native-7 live run with all EVAL_ROW PASS (operator gate per VALIDATION.md Section A) |
| EVAL-02 | 4-axis UAT scoreboard + uvicorn-restart-mid-workflow smoke per phase type including mid-ask_user | PARTIAL — structural fix VERIFIED; live verification NEEDS HUMAN + WR-01 FIX FIRST | BUG-260605-01 backend (Plan 03) + frontend (Plan 04) fixed and test-proven; restart_smoke.py built for all 3 kill points (Plan 07); BUT WR-01 makes single_completion_audit false-FAIL before the smoke can be validated; 4-axis UAT (SC#10 recipe) and 3 kill-point runs are operator-driven per VALIDATION.md |
| CONC-01 | llm_batch_agents fan-out bounded by max_parallel_agents; batch phase doesn't starve app GET latency <50ms; frontend stream-connection cap (BUG-260530-01) | PARTIAL — structural fix VERIFIED; live measurement NEEDS HUMAN | LRU-3 stream pool (Plan 05) fixes BUG-260530-01 structurally (5/5 tests pass); conc_probe.py built for N=10 fan-out + latency + AnyIO budget (Plan 07); MISSING: live N=10 probe run with PROBE_RESULT PASS + budget reading documented |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `scripts/restart_smoke.py:126-130` | _SQL_DOUBLE_COMPLETION uses `metadata->>'phase'` without double-encoded jsonb normalization — returns NULL for 386/386 live audit rows | Blocker | SC#2/SC#4 restart-smoke gate cannot produce SMOKE_ASSERT single_completion_audit PASS on any healthy run; the script is built and correct in all other respects but this SQL makes the mid-programmatic and mid-llm_agent kill points un-verifiable until fixed |
| `backend/app/services/harness_engine.py:1250` | definition = await _load_run_definition(...) followed by _resume_run without None guard | Blocker | A missing/corrupt workflow definition causes resume_stranded_workflows to raise AttributeError, re-raised by the sweep's except block, aborting all remaining stranded runs — the startup sweep is poisoned by a single bad run until the lease expires and re-poisons again |

### Human Verification Required

#### 1. Live Cross-Provider Eval (EVAL-01 / D-01 part 2)

**Test:** With uvicorn + local Supabase + Redis running and all native-7 provider keys in backend/.env:

```
backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --workflow
```

**Expected:** All 7 native providers (openai, anthropic, google, deepseek, moonshot, zhipu, minimax) emit `EVAL_ROW workflow <provider> <model_effective> PASS PASS PASS PASS PASS ...`; openrouter marked BEST-EFFORT (not gating). Capability table emitted to `.planning/eval/capability-table-2026-06-07.{json,md}`. `grep EVAL_ROW` diff vs the openai dry-run baseline shows the full 8-provider matrix.

**Why human:** Provider keys are localhost-only by design (D-01); live LLM costs and network dependencies make full 8-provider automation infeasible; the dry-run for openai alone was validated live (PASS, 54.5s) by the executor.

#### 2. Restart Smoke — 3 Kill Points (EVAL-02 / D-08)

**PREREQUISITE:** Apply the WR-01 fix to `scripts/restart_smoke.py` before running (see Gaps Summary).

**Test:** For each kill point, run `backend/venv/Scripts/python.exe scripts/restart_smoke.py --kill-at <point>` in a terminal, wait for the `SMOKE_KILL` banner, kill uvicorn (Ctrl+C in the uvicorn terminal), restart it, and let the script complete.

| Kill point | Expected SMOKE_ASSERT lines |
|---|---|
| programmatic | no_skipped_phases PASS · single_completion_audit PASS · no_duplicate_subagents PASS |
| llm_agent | no_skipped_phases PASS · single_completion_audit PASS · no_duplicate_subagents PASS |
| ask_user | no_skipped_phases PASS · single_completion_audit PASS · no_duplicate_subagents PASS · prompt_reemitted PASS · answer_reached_engine PASS |

The ask_user leg IS the BUG-260605-01 live fix verification. Also visually confirm: a FAILED run's ask_user card renders expired/disabled; a forced 404 submit shows "This prompt has expired — the run is no longer active" (not silence).

**Why human:** The human is the restart mechanism — the script deliberately never touches the uvicorn process (D-08 design).

#### 3. 4-Axis UAT Scoreboard (EVAL-02 / SC#10 recipe)

**Test:** Exercise all 6 rows from VALIDATION.md Section C:

- **Cross-provider:** covered by Section A live eval (same run)
- **Multi-tool:** one prompt using `search_documents` + `execute_code` on 2 providers; verify both tools invoked (DB `tool_calls` cross-check); run completes
- **Parallel-thread:** Thread A streaming (long `execute_code`) while Thread B accepts a new prompt; B not blocked; both complete; no cross-thread bleed
- **Stream-cap SC#5:** seed ≥6 concurrent active runs (below 6 the cap never saturates — Pitfall 8); switch between threads repeatedly; every switch reconciles <1s; max 3 held-open streams visible in DevTools Network tab
- **D-11a:** Capped-out background threads show the running pulse (status-derived) but NO live token progress until visited — this is designed behavior, not a bug
- **Long-message:** ≥50 prior messages OR ≥5KB prompt on ≥2 providers; stream completes, no truncation/stall, reload renders full history

**Why human:** Visual behavior, real-time <1s measurement (operator stopwatch or DevTools), and the multi-provider/multi-thread axes require a live browser session.

#### 4. Concurrency Measurements (CONC-01 / SC#3)

**Test:** With uvicorn + local stack running:

```
backend/venv/Scripts/python.exe scripts/conc_probe.py
```

**Expected:**
- `PROBE_ASSERT fanout_bounded PASS` (max interval overlap ≤5, total sub-runs == 10)
- `PROBE_ASSERT cross_tab_latency PASS` (p95 < 50ms on both /snapshot and /threads)
- `PROBE_BUDGET total=<n> peak_borrowed=<n>` — record the values here for the SEED-036a AnyIO sizing conclusion

**Why human:** Live N=10 fan-out against the real harness engine requires the backend running; measurement of real DB interval windows cannot be faked.

---

## Gaps Summary

**2 structural gaps require fixing before the phase can fully close:**

### Gap 1 (WR-01): restart_smoke.py false-FAIL on double-encoded jsonb — Blocker for SC#2/SC#4

The `_SQL_DOUBLE_COMPLETION` constant in `scripts/restart_smoke.py` (lines 126-130) does not normalize the double-encoded jsonb in `harness_audit.metadata`. This was discovered during Plan 06's live dry-run (DI-096-06-A), fixed in `eval_cross_provider.py`, but not propagated to `restart_smoke.py`. Every healthy eval_coverage run (5 phase_completed rows grouped under NULL slug by the broken aggregation) triggers a `HAVING count(*) > 1` false-positive, causing `single_completion_audit FAIL` on every restart smoke run.

**The fix is a one-SQL change — apply the CASE WHEN normalization from the REVIEW:**

```python
_SQL_DOUBLE_COMPLETION = (
    "SELECT (CASE WHEN jsonb_typeof(metadata) = 'string' "
    "THEN (metadata #>> '{}')::jsonb ELSE metadata END)->>'phase' AS slug, "
    "count(*) AS n FROM harness_audit "
    "WHERE run_id = %s AND event_type = 'phase_completed' "
    "GROUP BY 1 HAVING count(*) > 1"
)
```

### Gap 2 (WR-02): resume_stranded_workflows poisons all resumes on missing definition — Blocker for restart smoke reliability

`resume_stranded_workflows` (harness_engine.py:1250) does not guard against `_load_run_definition` returning `None` (documented return when the definition row is absent). A bare `None` passed to `_resume_run` → `definition.phases` raises `AttributeError`, re-raised by the sweep's `except Exception: raise`, aborting all remaining stranded runs in that boot. The next boot re-poisons.

**The fix is a one-guard addition:**

```python
definition = await _load_run_definition(pool, run_id)
if definition is None:
    logger.warning(
        "resume sweep: run %s has no loadable definition — skipping "
        "(re-claimable after lease expiry)", run_id,
    )
    continue
ctx = await _build_resume_context(run, redis, pool)
```

Note: `test_resume_finalizer_expires_on_failed_redrive` in `test_096_askuser_cleanup.py` (lines 241-264) asserts the current propagate-raise behavior and would need updating if per-run isolation is also added (`continue` instead of `raise`).

**Both gaps are in operator scripts/infrastructure code, not in the production harness path itself.** The production harness (harness_engine, task_service, phase_types, panel.py, StreamsProvider) is correct and test-proven. The CI gate (test_096_ci_workflow_regression.py) is green. Only the measurement/smoke infrastructure needs these two surgical fixes before the live operator runs can produce clean evidence.

---

## Additional Findings (Non-Blocking)

The REVIEW identified 3 additional lower-priority items not classified as gaps:

- **WR-03**: `tool_refused` audit rows land in the producer-runs namespace (not the workflow_run namespace) — evidence is invisible to per-run audit queries by workflow_run_id. No current consumer is affected; the CI test proves the guard fires; the namespace mismatch is a future observability concern.
- **WR-04**: `conc_probe.py` asserts fan-out against hardcoded `MAX_ALLOWED_OVERLAP = 5` instead of the live `max_parallel_agents` it already reads — false-PASS risk if `--workflow-slug` points at a workflow with a lower cap. For the default `literature_review` (cap=5) this is correct.
- **IN-05**: `restart_smoke.py` and `conc_probe.py` DEFAULT_MODELS tables carry stale anthropic/zhipu/minimax IDs that contradict the D-05 curation in Plan 08 (functional impact near-zero since body.model doesn't steer harness phases, but the copy-claim comments are false).

These do not block the operator runs for `literature_review` (default workflow) and are documented here for the gap-closure planner.

---

_Verified: 2026-06-07T10:15:00Z_
_Verifier: Claude (gsd-verifier)_
