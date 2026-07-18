---
phase: 120
slug: collision-fix-context-isolation
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-22
validated: 2026-06-22
---

# Phase 120 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from RESEARCH.md `## Validation Architecture` (SC#1–4 map, headline
> live-repro regression test, SC#10 4-axis matrix). Per-Task Verification Map
> filled from the 3 plans (01 COLL-01, 02 CTX-01, 03 BLOCKING apply).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (`asyncio_mode = auto`) |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_120_collision_regression.py tests/test_120_origin_filter.py -x` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` |
| **Estimated runtime** | quick set < 10 s (mocked sessions); full suite per existing baseline |

---

## Sampling Rate

- **After every task commit:** Run the quick command on the phase test files (< 10 s).
- **After every plan wave:** Run the full suite command (watch `test_075_4_*`, `test_dual_mode_wiring.py`, `test_093_surfacing.py` — they exercise the shared harvest + persist helper).
- **Before `/gsd:verify-work`:** Full suite green + migration 076 applied to live DB + `full-schema.sql` regenerated.
- **Max feedback latency:** < 10 s for the unit set; integration test requires the live DB (Plan 03).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 120-01-01 | 01 | 1 | COLL-01 | T-120-02 | Headline test reproduces the TRUE live signature; RED before fix | unit | `venv/Scripts/python -m pytest tests/unit/test_120_collision_regression.py -x` | ✅ | ✅ green (4/4) |
| 120-01-02 | 01 | 1 | COLL-01 | T-120-01 / T-120-02 / T-120-03 | Run-scoped harvest excludes pre-existing files; thread-keyed session only; run_in_threadpool | unit | `venv/Scripts/python -m pytest tests/unit/test_120_collision_regression.py -x` | ✅ | ✅ green (4/4) |
| 120-02-01 | 02 | 1 | CTX-01 | T-120-04 / T-120-06 / T-120-08 | Every HARNESS insert site tags 'harness'; raw INSERT uses $N (no f-string); CHECK enum | unit (source) | `venv/Scripts/python -m pytest tests/test_120_origin_filter.py::TestHarnessSitesTagHarness -x` | ✅ | ✅ green (6/6) |
| 120-02-02 | 02 | 1 | CTX-01 | T-120-05 / T-120-04 | Asymmetric filter; owner/thread scope preserved; origin out of projection; Deep byte-identical | unit | `venv/Scripts/python -m pytest tests/test_120_origin_filter.py -x` | ✅ | ✅ green (14/14) |
| 120-03-01 | 03 | 2 | CTX-01 | T-120-07 / T-120-08 | Live-DB integration test (zero NULL origin, CHECK accept/reject) authored | integration | `venv/Scripts/python -m pytest tests/integration/test_120_migration.py -x` | ✅ | ✅ green (3/3, live) |
| 120-03-02 | 03 | 2 | CTX-01 | T-120-07 / T-120-09 | Migration applied via SQL editor (NEVER db push/reset); full-schema regenerated | manual (BLOCKING) | human-action checkpoint | n/a | ✅ done (live :54322, full-schema.sql:615-616) |
| 120-03-03 | 03 | 2 | CTX-01 | T-120-07 / T-120-08 | Zero NULL origin on live DB; CHECK rejects out-of-domain; full Phase 120 set green | integration | `venv/Scripts/python -m pytest tests/integration/test_120_migration.py tests/unit/test_120_collision_regression.py tests/test_120_origin_filter.py -x` | ✅ | ✅ green (21/21, live) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **State-A reconciliation 2026-06-22:** this map was authored plan-time (all ⬜ pending). Reconciled to executed reality — every referenced test file exists and the full Phase 120 set runs **21/21 green live** (3 integration + 4 collision-regression + 14 origin-filter). The BLOCKING migration apply (120-03-02) is confirmed live on :54322 (zero NULL origin, CHECK present) and in `supabase/full-schema.sql:615-616`.

---

## Phase SC → Test Map

| SC | Behavior | Plan/Task | Test | Result |
|----|----------|-----------|------|--------|
| SC#1 (COLL-01) | Skill execute_code saving one file in a post-workflow thread emits EXACTLY that one file (headline D-120-08) | 01 / T1+T2 | `test_120_collision_regression.py::test_stale_workflow_file_excluded_from_skill_emit` | ✅ green |
| SC#1 (pre-fix guard) | Empty baseline emits BOTH files (contrast case; see IN-01 — pins behavior, not a flip-on-fix oracle) | 01 / T1 | `test_120_collision_regression.py::test_empty_baseline_emits_both_files_pre_fix` | ✅ green |
| SC#2 (COLL-01) | Harvest run-scoped; snapshot seeds existing files; empty dir → {} | 01 / T2 | `test_120_collision_regression.py::test_snapshot_seeds_existing_files` | ✅ green |
| SC#2 (Harness symmetry D-120-03) | Harness phase keeps own output, excludes prior leftover | 01 / T2 | `test_120_collision_regression.py::test_harness_phase_keeps_own_output` | ✅ green |
| SC#3 (CTX-01 migration) | Zero NULL origin; CHECK accepts deep/harness rejects other | 03 / T1+T3 | `test_120_migration.py` (3 tests, live :54322) | ✅ green (live) |
| SC#3 (CTX-01 filter) | Deep neq('origin','harness'); Harness eq('origin','harness') | 02 / T2 | `test_120_origin_filter.py::TestAsymmetricFilterPerMode` (3) + `TestDeepPureThreadNoop::test_deep_filter_drops_only_harness_rows` | ✅ green |
| SC#3 (CTX-01 tagging) | Every HARNESS insert site tags 'harness' | 02 / T1+T2 | `test_120_origin_filter.py::TestHarnessSitesTagHarness` (6, incl. raw-INSERT-no-fstring + mode-aware api/runs) | ✅ green |
| SC#4 (Deep byte-identical) | Pure-Deep thread → identical filtered row set; origin out of projection | 02 / T2 | `TestDeepPureThreadNoop::test_deep_pure_thread_filter_is_noop` + `TestProjectionAndScope::test_origin_not_in_history_select_projection` + `…::test_owner_and_thread_scope_preserved_on_history_query` | ✅ green |
| SC#10 | 4-axis live UAT (manual) | — | Manual-Only Verifications below | ✅ done (live UAT PASS, `2eef0d2c`) |

---

## Wave 0 Requirements

- [x] `backend/tests/unit/test_120_collision_regression.py` — headline live-repro (D-120-08), snapshot seed, Harness symmetry (Plan 01 T1) — **4/4 green**.
- [x] `backend/tests/test_120_origin_filter.py` — asymmetric filter per mode, harness-site tagging, Deep byte-identical no-op, origin-not-in-projection (Plan 02 T2) — **14/14 green**.
- [x] `backend/tests/integration/test_120_migration.py` — live-DB migration semantics (Plan 03 T1) — **3/3 green (live :54322)**.
- [x] No framework install needed — pytest + pytest-asyncio already in use; reused `test_075_4_dedup_supersedes.py` scaffold.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SC#10 4-axis live UAT: cross-provider (OpenAI / Anthropic / Google / OpenRouter, native-7 representative) × multi-tool × parallel-thread × ≥50-msg history | COLL-01 / CTX-01 | Live cross-provider streaming + real Docker sandbox; re-run of live thread 99af24d5 | Per RESEARCH.md SC#10 matrix. (a) Cross-provider: run workflow render → Deep skill execute_code on each provider; assert exactly one file emitted + Deep history clean. (b) Multi-tool: a post-workflow Deep turn using search_documents + execute_code; only the new file emits. (c) Parallel-thread: Thread A (workflow) streaming while Thread B accepts a new Deep prompt; baselines/origin filters thread-scoped (no cross-thread bleed). (d) Long-message: post-workflow thread ≥50 mixed deep+harness rows; Deep replays only deep+legacy and the new skill file emits cleanly. Deep Mode proven byte-identical on the native-7. |
| Live bug confirmation | COLL-01 | The actual reported live bug | Re-run thread 99af24d5 (or an equivalent reproduction) end-to-end; confirm the 2-files bug is gone. |

> Authored under VALIDATION.md (UAT scoreboard recipe), NOT in PLAN.md tasks.
>
> **SC#10 status (2026-06-22):** the 4-axis cross-provider live UAT was completed in
> `/gsd:verify-work` — `120-HUMAN-UAT.md` records SC#10 4-axis + the 2-files-bug
> reproduction both PASS (commit `2eef0d2c`: "complete live UAT — SC#10 4-axis +
> 2-files bug PASS (2 passed, 0 issues)"). These remain manual-only by nature (live
> cross-provider streaming + real Docker sandbox cannot be auto-driven in CI) but are
> verifiably DONE, not outstanding.

---

## Validation Audit 2026-06-22

| Metric | Count |
|--------|-------|
| Requirements | 2 (COLL-01, CTX-01) |
| Automated SCs (SC#1–4) | COVERED — 21/21 green live |
| Gaps found | 0 |
| Resolved | 0 (no gaps — no auditor spawn) |
| Escalated / Manual-only | SC#10 (4-axis live UAT) — done in verify-work |

**State A reconciliation (no gaps):** the plan-time draft (all tasks ⬜ pending,
`status: ready`, `wave_0_complete: false`) was reconciled to executed reality. Every
referenced test file exists; the full Phase 120 set runs **21/21 green live**
(`test_120_migration.py` 3 + `test_120_collision_regression.py` 4 +
`test_120_origin_filter.py` 14). The integration suite was re-run by the orchestrator
against the live local DB (:54322) — zero NULL origin, CHECK non-vacuous accept/reject.
No MISSING or PARTIAL requirement remained, so no `gsd-nyquist-auditor` was spawned
(Step 3 "no gaps → skip to Step 6"). SC#1–4 are fully automated; SC#10 stays manual by
nature and is verifiably complete (`120-HUMAN-UAT.md`). `nyquist_compliant: true`.

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (3 net-new test files — all present + green)
- [x] No watch-mode flags
- [x] Feedback latency < 10 s (unit set)
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Full Phase 120 set re-run green live (21/21) at validation time
- [x] BLOCKING migration apply (120-03-02) confirmed live + in full-schema.sql

**Approval:** validated — NYQUIST-COMPLIANT (2026-06-22)
