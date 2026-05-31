---
phase: 092
slug: dual-mode-wiring-continue-button
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-31
---

# Phase 092 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Per-task map populated by the planner from RESEARCH.md `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend, async, mock_asyncpg_pool/fake_redis fixtures) + Chrome DevTools MCP (frontend/cross-provider UAT) |
| **Config file** | backend pytest (existing `test_harness_*.py` suite + new `test_dual_mode_wiring.py` / `test_continue.py` / `test_thread_workflow_endpoint.py`) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/test_dual_mode_wiring.py tests/test_continue.py tests/test_thread_workflow_endpoint.py -x -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` |
| **Frontend gate** | `cd frontend && npx tsc --noEmit && npm run build` |

---

## Sampling Rate

- **After every task commit:** Quick run command (the relevant test file)
- **After every plan wave:** Full backend suite (`pytest tests/ -q`) + `tsc --noEmit` for frontend waves
- **Before `/gsd-verify-work`:** Full backend suite green + frontend build green + Chrome MCP 4-axis + the SC#2 Supabase lock-clear queries
- **Max feedback latency:** quick run < ~30s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 migration 063 | 01 | 1 | MODE-01/02, CONT-01 | T-092-01/02 | safe DDL defaults; full status set preserved | grep | `grep -q cap_paused supabase/migrations/063_dual_mode_continue.sql` | yes | ⬜ pending |
| 01-T2 test scaffolds + verify_092.sql | 01 | 1 | all | — | — | pytest collect | `pytest tests/test_dual_mode_wiring.py tests/test_continue.py tests/test_thread_workflow_endpoint.py -q` | yes | ⬜ pending |
| 01-T3 operator apply migration | 01 | 1 | all | T-092-03 | operator-applied (SQL editor, no db push) | manual+grep | `grep -q continues_used supabase/full-schema.sql` | n/a | ⬜ pending (checkpoint) |
| 02-T1 create_workflow_run + list_published | 02 | 2 | MODE-01 | T-092-08 | $N params; FK-ordered txn; service-role helper trusts upstream ownership | pytest | `pytest tests/test_dual_mode_wiring.py -k create_workflow_run -q` | yes | ⬜ pending |
| 02-T2 kickoff field + producer branch + lock | 02 | 2 | MODE-01/02 | T-092-05/06 | RLS-scoped definition resolve; server-side 409 lock | pytest | `pytest tests/test_dual_mode_wiring.py -k "branches or lock" -q` | yes | ⬜ pending |
| 02-T3 GET workflow + ThreadWorkflowState + published list | 02 | 2 | MODE-01/02 | T-092-04/07 | ownership 404; owner-scoped list; pure read | pytest | `pytest tests/test_thread_workflow_endpoint.py -q` | yes | ⬜ pending |
| 03-T1 persist-at-cap + cap_paused + SSE | 03 | 3 | CONT-01 | T-092-12 | server-persisted dropped calls; non-terminal event | pytest | `pytest tests/test_continue.py -k "persist or byte_identical" -q` | yes | ⬜ pending |
| 03-T2 POST /continue + 3-cap + knob | 03 | 3 | CONT-01 | T-092-09/10 | ownership 404; durable 3-cap server-side | pytest | `pytest tests/test_continue.py -q` | yes | ⬜ pending |
| 03-T3 cancel/terminal lock-clear | 03 | 3 | MODE-02 | T-092-11 | same-txn clear, exactly once; cap_paused cancellable | pytest+SQL | `pytest tests/test_dual_mode_wiring.py -k cancel -q` (+ live SC#2 query) | yes | ⬜ pending |
| 04-T1 api.ts clients + cap_paused SSE | 04 | 4 | MODE-01/02, CONT-01 | T-092-16 | reconcile-as-truth client | tsc | `cd frontend && npx tsc --noEmit` | yes | ⬜ pending |
| 04-T2 per-thread lock Map + selector | 04 | 4 | MODE-02 | T-092-15 | per-thread keyed, no global boolean | tsc | `cd frontend && npx tsc --noEmit` | yes | ⬜ pending |
| 04-T3 toggle+picker+Continue card | 04 | 4 | MODE-01/02, CONT-01 | T-092-14 | grayed = courtesy; server is authority | tsc+build | `cd frontend && npx tsc --noEmit && npm run build` | yes | ⬜ pending |
| 04-T4 Chrome MCP lived-experience UAT | 04 | 4 | MODE-01/02, CONT-01 | T-092-15/16 | parallel-thread + reconcile + cross-provider | manual (Chrome MCP) | see Manual-Only below | n/a | ⬜ pending (checkpoint) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Created in Plan 01 (Task 2) — these scaffolds collect cleanly (skipped contracts) so the suite stays green; each downstream plan removes its own skips:

- [ ] `backend/tests/test_dual_mode_wiring.py` — SC#1 branch + SC#2 lock-clear txn + Q5 create_workflow_run atomicity (incl. phase-row inserts + FK ordering)
- [ ] `backend/tests/test_continue.py` — SC#4 persist-then-consume + 3-cap refusal + Harness available_tools re-read + Deep byte-identical
- [ ] `backend/tests/test_thread_workflow_endpoint.py` — SC#5 ThreadWorkflowState shape + lock_is_stale heal + pure-read invariant
- [ ] `supabase/verify_092.sql` — live-DB gate: migration 063 columns + cap_paused on both status CHECKs + a sample lock round-trips to NULL

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SC#3 per-thread lock NOT a global boolean | MODE-02 | Parallel-thread lived-experience gate (BUG-260523-01) — needs two live threads | Thread A starts a workflow (locked + streaming); confirm Thread B's Deep/Harness toggle + composer + General/Explorer selector stay FREE; switch back to A — still locked. **Binding gate.** |
| SC#5 reconcile via fetch on mount; no dangling lock | MODE-02 | Reload mid-stream + Realtime-as-hint behavior is browser-only | Reload mid-workflow on Thread A → composer/lock reconciles from GET /threads/{id}/workflow (not a stale hint); cancel via Stop → thread unlocks |
| SC#2 anchor NULL after cancel AND natural terminal | MODE-02 | The binding proof is a live Supabase query, not a log line | After cancel AND after a natural workflow completion: `SELECT active_workflow_run_id FROM threads WHERE id='<thread>'` → NULL both times |
| CONT-01 Continue consumes dropped tools, same run_id, 3-cap | CONT-01 | Needs a live run driven to the cap + a LangSmith trace proving the dropped tools actually ran | Drive a Deep run / Harness phase to its cap → Continue card with dropped tool names → click → dropped tools run (transcript + LangSmith), same run_id; repeat to 3-cap, 4th refused |
| SC#10 4-axis cross-provider UAT (native-7) | MODE-01/02, CONT-01 | Live native-7 workflow runs; ALSO unblocks 091's persisted cross-provider workflow UAT (no INSERT INTO workflow_runs existed before 092) | Seed a workflow kickoff + a Deep multi-tool prompt across OpenAI/Anthropic/Google/DeepSeek/Moonshot/GLM/MiniMax (OpenRouter best-effort) × multi-tool × parallel-thread × ≥50-msg/≥5KB long-message; both agent_mode values; zero regressions; confirm a persisted workflow_runs row |
| Deep Mode byte-identical (additive-only) | MODE-01 | SSE-stream equivalence needs the 089 capture/normalize harness | A Deep multi-tool run's SSE event sequence is structurally identical pre/post (089 run1-vs-run1 structural diff empty); `active_workflow_run_id IS NULL` path unchanged |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify OR a Wave 0 dependency / are explicit checkpoints (01-T3, 04-T4)
- [x] Sampling continuity: no 3 consecutive code tasks without automated verify
- [x] Wave 0 covers all MISSING references (3 test files + verify_092.sql in Plan 01)
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved (pending execution)
