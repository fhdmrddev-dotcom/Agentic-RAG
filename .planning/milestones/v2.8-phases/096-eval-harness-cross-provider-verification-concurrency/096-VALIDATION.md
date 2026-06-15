---
phase: 096
slug: eval-harness-cross-provider-verification-concurrency
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-07
updated: 2026-06-07
---

# Phase 096 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) / vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -x -q` (scoped to touched test files per task) |
| **Full suite command** | backend: `venv/Scripts/python -m pytest tests/ -q` · frontend: `npm run test -- --run` |
| **Estimated runtime** | ~60-120 seconds |

> Frontend vitest has a documented ~16-failure pre-existing baseline cluster (SEED-056) and `tsc -b` baseline 37; backend pytest has a large pre-existing local failure baseline — prove net-new=0 via the 095.1 git-stash baseline comparison, never raw counts.

---

## Sampling Rate

- **After every task commit:** Run the scoped quick command for the touched module
- **After every plan wave:** Run the full suite command (+ frontend `tsc -b` + `npm run build` when frontend touched)
- **Before `/gsd-verify-work`:** Full suite green modulo documented baselines + the manual-only table below executed
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 eval_slow_step fn | 096-01 | 1 | EVAL-01/EVAL-02 | T-096-01-02 | closed-registry fn, no dynamic resolution | import check | `venv/Scripts/python.exe -c "from app.services.harness.programmatic import eval_slow_step"` (registry assert) | ❌ W0 | ⬜ pending |
| 01-T2 migration 066 | 096-01 | 1 | EVAL-01/EVAL-02 | T-096-01-01 | idempotent fixed-uuid inserts | script assert | python JSONB-parse + 5-type-order check (in plan) | ❌ W0 | ⬜ pending |
| 01-T3 [BLOCKING] apply+regen | 096-01 | 1 | EVAL-01/EVAL-02 | T-096-01-01 | SQL-editor apply, never db push | DB assert | psycopg2 SELECT seed row + `grep eval_coverage supabase/full-schema.sql` | ❌ W0 | ⬜ pending |
| 02-T1 CI happy-path journey | 096-02 | 1 | EVAL-01 | T-096-02-01 | no secrets, fake provider only | pytest | `pytest tests/test_096_ci_workflow_regression.py -x -q -k happy_path` | ❌ W0 | ⬜ pending |
| 02-T2 gate/whitelist/resume legs | 096-02 | 1 | EVAL-01 | T-096-02-02/03 | real dispatch_tool guard runs; 2-phase writes asserted | pytest | `pytest tests/test_096_ci_workflow_regression.py -q` | ❌ W0 | ⬜ pending |
| 03-T1 terminal ask_user cleanup | 096-03 | 1 | EVAL-02 | T-096-03-03/04 | INSERT-only expiry, $-params | pytest | `pytest tests/test_096_askuser_cleanup.py -x -q -k "expire or cleanup"` | ❌ W0 | ⬜ pending |
| 03-T2 /pending liveness filter | 096-03 | 1 | EVAL-02 | T-096-03-01/02 | owner-scope unchanged; filter narrows only; runs.py diff empty | pytest | `pytest tests/test_096_askuser_cleanup.py -q` | ❌ W0 | ⬜ pending |
| 04-T1 answerAskUser ApiError | 096-04 | 1 | EVAL-02 | T-096-04-02 | status propagated, no body echo | tsc | `npx tsc -b` (baseline 37) | ✅ extend | ⬜ pending |
| 04-T2 PendingAskCard honesty | 096-04 | 1 | EVAL-02 | T-096-04-01 | text children only, innerHTML==0 | vitest | `npx vitest run src/components/panel/__tests__/PendingAskCard.test.tsx` | ✅ extend | ⬜ pending |
| 05-T1 LRU-3 stream pool | 096-05 | 1 | CONC-01 | T-096-05-01/02 | bounded connections; backend diff empty | vitest | `npx vitest run src/__tests__/providers/streamPool.test.tsx` | ❌ W0 | ⬜ pending |
| 05-T2 D-10 audit + sweep | 096-05 | 1 | CONC-01 | T-096-05-02 | status-derived indicators, no fake activity | vitest+tsc+build | `npx vitest run src/__tests__/providers/ && npx tsc -b` | ❌ W0 | ⬜ pending |
| 06-T1 eval workflow rows | 096-06 | 2 | EVAL-01 | T-096-06-01/03/04 | localhost-gate first; allowlisted SQL; owner-scoped answer | py_compile+help | `python -m py_compile scripts/eval_cross_provider.py && ... --help` | ✅ extend | ⬜ pending |
| 06-T2 capability table + gate docs | 096-06 | 2 | EVAL-01 | T-096-06-02 | names/metrics only in artifacts | py_compile+grep | py_compile + `grep capability-table .planning/eval/README.md` | ❌ W0 | ⬜ pending |
| 07-T1 restart_smoke.py | 096-07 | 2 | EVAL-02 | T-096-07-01/04 | localhost gate; human-only restart (no subprocess uvicorn) | py_compile+help | `python -m py_compile scripts/restart_smoke.py && ... --help` | ❌ W0 | ⬜ pending |
| 07-T2 conc_probe.py | 096-07 | 2 | CONC-01 | T-096-07-01/02/03 | localhost gate; metrics-only output | py_compile+help | `python -m py_compile scripts/conc_probe.py && ... --help` | ❌ W0 | ⬜ pending |
| 08-T1 curate_models.py | 096-08 | 3 | EVAL-01 | T-096-08-01 | names-only output, no key values | py_compile+live run | `python -m py_compile scripts/curate_models.py && ... --help` | ❌ W0 | ⬜ pending |
| 08-T2 apply curation | 096-08 | 3 | EVAL-01 | T-096-08-02/03 | live-confirmed IDs only; audited app_settings UPDATEs | import+pytest | `python -c "from app.config import MODEL_CAPABILITIES"` + `pytest -k "config or capabilities"` | ✅ extend | ⬜ pending |
| 08-T3 [checkpoint] diff approval | 096-08 | 3 | EVAL-01 | T-096-08-04 | operator approves before commit | manual | — (checkpoint) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_096_ci_workflow_regression.py` — D-01 structural gate (fake gateway adapter at the `open_stream` seam + mock_asyncpg_pool + real/fake Redis) → Plan 02
- [ ] `backend/tests/test_096_askuser_cleanup.py` — D-06 backend (terminal cleanup + /pending dual-namespace filter) → Plan 03
- [ ] `frontend/src/__tests__/providers/streamPool.test.tsx` — pool enforcement / eviction bookkeeping / reattach / PANEL-06 isolation (path corrected from RESEARCH's `src/providers/__tests__/` to the project's existing `src/__tests__/providers/` convention) → Plan 05
- [ ] `supabase/migrations/066_eval_coverage_seed.sql` + `eval_slow_step` — the D-02 max-coverage 5-type seed + the mid-`programmatic` kill window → Plan 01 (incl. the [BLOCKING] SQL-editor apply)
- [ ] `scripts/restart_smoke.py` — D-08 helper (seed, kill-signal banner, DB-truth assertions) → Plan 07
- [ ] `scripts/conc_probe.py` — fan-out overlap + latency + backpressure sampling → Plan 07
- [ ] eval script extension — workflow row type + capability-table emitter → Plan 06
- No framework installs needed.

---

## Manual-Only Verifications

> Executed by the operator (Claude-assisted) at phase verification. Chrome MCP can HANG (memory 2026-06-06) — fallback is operator-drives-clicks + Claude DB-cross-checks via psycopg2 (localhost:54322).

### A. Live cross-provider eval (EVAL-01 / D-01 part 2 — the operator gate)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native-7 workflow eval rows all PASS | EVAL-01 / SC#1 | Provider keys are localhost-only by design (D-01); live providers are costly/flaky | `backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --workflow` with uvicorn + Supabase up. Grep `EVAL_ROW` lines: per native-7 provider — workflow_completed ✓, phases in locked order ✓, single phase_completed audit per phase ✓, `search_documents` round-trip ✓, ask_user auto-answered ✓, `model_effective` column == runs.model (never the requested model). OpenRouter row recorded best-effort, excluded from the pass bar (D-03). Capability table emitted at `.planning/eval/capability-table-2026-06-*.{json,md}` and committed (D-04). |

### B. Restart-smoke matrix (EVAL-02 / SC#2 + SC#4 — D-08, HARNESS-03 verification)

Run `backend/venv/Scripts/python.exe scripts/restart_smoke.py --kill-at <point>` per row; operator kills/restarts uvicorn in their visible terminal when the `SMOKE_KILL` banner prints. All assertions are robot-checked (`SMOKE_ASSERT` lines).

| Kill point | Workflow | Window | Assertions (all must print PASS) |
|------------|----------|--------|-----------------------------------|
| mid-`programmatic` | eval_coverage (`split` phase, eval_slow_step ~20s window — REAL kill, never faked per Pitfall 4) | phase `active` | no_skipped_phases · single_completion_audit · no_duplicate_subagents (re-run-from-top is SAFE: fn is pure/idempotent) |
| mid-`llm_agent` | eval_coverage (`deep_dive` phase) | phase `active` | no_skipped_phases · single_completion_audit · no_duplicate_subagents |
| mid-`ask_user` | eval_coverage (`confirm` phase, prompt pending) | prompt pending | no_skipped_phases · single_completion_audit · **prompt_reemitted** (panel re-renders the prompt post-restart) · **answer_reached_engine** (POST after restart completes the run) — this row IS the BUG-260605-01 live fix verification (D-06): also visually confirm the pre-restart orphan card from any FAILED run renders expired/disabled, and a forced 404 submit shows the visible "prompt has expired" message, never silence |

### C. 4-axis UAT scoreboard (EVAL-02 / SC#10 recipe — mandatory bandwidth)

| Axis | Row | Providers/Scale | Pass condition |
|------|-----|-----------------|----------------|
| Cross-provider | The Section-A live eval drives the SAME 5-type workflow on all native-7 (one representative model each, per the curated defaults table) | openai, anthropic, google, deepseek, moonshot, zhipu, minimax | All 7 EVAL_ROW PASS; 093 D-21's native-7 × 5-type × 4-workflow breadth stays the deep-check reference (D-02 — not re-run per eval) |
| Multi-tool | One Deep-mode prompt exercising 2+ tools (`search_documents` + `execute_code`) on ≥2 providers (1 native flagship + 1 non-OpenAI native) | e.g. openai + google | Both tools invoked in one run (DB `tool_calls` cross-check); tool cards render; run completes honestly |
| Parallel-thread | Thread A streaming (long `execute_code` task) while Thread B accepts a new prompt and streams | any 2 providers | B's send is not blocked; both runs complete; no cross-thread bleed (per-thread demux intact) |
| Parallel-thread (stream-cap, SC#5) | Seed **≥6 concurrent active runs** (6 threads × 1 long-running prompt — below 6 the connection pool never saturates and the test passes vacuously, Pitfall 8). Switch between threads repeatedly | mixed providers | Every thread-switch reconciles **<1s** (snapshot renders, then live tokens resume via cursor replay — DevTools Network or operator stopwatch + psycopg2 cross-check); max 3 held-open stream fetches visible in the Network tab |
| Parallel-thread (D-11a assertion) | With the ≥6-run scenario: observe threads OUTSIDE the LRU-3 pool | — | Capped-out background threads show the existing "running" pulse (status from runs list) with **NO live token progress until visited — this is DESIGNED behavior, asserted here so a future phase never "fixes" it as a bug**. No fake activity, no simulated tokens (D-10/D-11a) |
| Long-message | One thread with ≥50 prior messages OR a ≥5KB prompt, per native provider where budget allows (minimum: 2 providers) | e.g. anthropic + zhipu | Stream completes; no truncation/stall; reload renders full history |

### D. Concurrency measurements (CONC-01 / SC#3)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| N=10 fan-out ≤5 concurrent | CONC-01 / SC#3 | Live load against the real engine | `scripts/conc_probe.py` — `PROBE_ASSERT fanout_bounded PASS` (max interval overlap ≤5, 10 sub-runs) |
| Cross-tab GET p95 <50ms during batch | CONC-01 / SC#3 | Live latency under real fan-out | Same run — `PROBE_ASSERT cross_tab_latency PASS` (direct HTTP client, never browser — measures backend starvation, not the connection cap) |
| AnyIO threadpool budget verified | CONC-01 / SC#3 / SEED-036a | Live reading is the verification | Same run — record `PROBE_BUDGET total=<n> peak_borrowed=<n>` here: total=___ peak=___ → documented conclusion on max_parallel_agents=5 default safety (note per_worker_run_count under WORKER_COUNT=2) |

---

## Phase-gate evidence checklist (before `/gsd:verify-work 096`)

- [ ] CI: `test_096_ci_workflow_regression.py` green locally AND on a GitHub Actions run (D-01 part 1)
- [ ] Section A scoreboard captured (EVAL_ROW grep) + capability table committed
- [ ] Section B: 3/3 kill-point rows with all SMOKE_ASSERT PASS
- [ ] Section C: all 6 rows executed with evidence (screenshots optional; DB cross-checks recorded)
- [ ] Section D: PROBE_RESULT PASS + budget reading filled in
- [ ] Reported-bugs frontmatter: BUG-260605-01 + BUG-260530-01 flipped to `closed` + `verified_closed_by: "096"` ONLY if no longer reproducing in B/C
- [ ] Baselines: backend net-new 0, frontend vitest net-new 0 (stash-proven), tsc 37, build exit 0

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (see Per-Task map — every row carries a command; checkpoints excepted)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
