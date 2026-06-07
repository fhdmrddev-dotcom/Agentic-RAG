---
status: partial
phase: 096-eval-harness-cross-provider-verification-concurrency
source: [096-VERIFICATION.md, 096-REVIEW-FIX.md]
started: 2026-06-07T22:30:00Z
updated: 2026-06-07T22:30:00Z
---

## Current Test

[awaiting human testing]

## Note on verification gaps

096-VERIFICATION.md recorded 2 structural gaps (WR-01 restart_smoke false-FAIL, WR-02 resume
sweep poison-pill). Both are FIXED and committed (4b2229b6, acffe95d + b74ae85d follow-up),
along with WR-03 (15d1259d) and WR-04 (d9f78b0b). Net-new test failures vs phase base
53dc5823: 0 (62=62, byte-identical). The items below are the operator-driven live proofs
096-VALIDATION.md classifies as manual-only.

## Tests

### 1. Full native-7 cross-provider eval run (EVAL-01 / D-01 part 2)
expected: `backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --workflow` (per
.planning/eval/README.md ritual) completes for all native providers; each provider's
EVAL_ROW shows the locked 5-phase sequence with correct tool round-trips; the D-04
capability table (JSON+MD) is emitted and committed as the first versioned artifact.
OpenAI single-provider dry-run already PASSED live (54.5s, robot-answered ask_user).
result: [pending]

### 2. Restart smoke — 3 kill points (EVAL-02 / D-08 / SC#2 / SC#4)
expected: With backend running, `scripts/restart_smoke.py --kill-at programmatic` (then
`llm_agent`, then `ask_user`): script prints SMOKE_KILL banner, operator kills + restarts
uvicorn, script detects restart via /health and asserts DB truth — no_skipped_phases PASS,
single_completion_audit PASS (WR-01 normalization now applied), no_duplicate_subagents PASS.
The ask_user leg additionally asserts prompt_reemitted + answer-after-restart completion
(BUG-260605-01 live verification).
result: [pending]

### 3. 4-axis UAT scoreboard (SC#10)
expected: Cross-provider × multi-tool × parallel-thread × long-message rows per
096-VALIDATION.md, including the ≥6-run stream-cap scenario (SC#5: LRU-3 pool evicts
oldest, honest background indicators per D-10, snapshot-then-replay on return per D-11,
no 15-30s thread-switch hang) and the D-11a honest-indicator confirmation.
result: [pending]

### 4. N=10 concurrency probe (CONC-01 / SC#3)
expected: `scripts/conc_probe.py` emits PROBE_ASSERT fanout_bounded PASS (max overlap ≤
live max_parallel_agents, total == 10), PROBE_ASSERT cross_tab_latency PASS (p95 < 50ms),
and a PROBE_BUDGET total/peak_borrowed reading recorded for SEED-036a AnyIO sizing.
result: [pending]

### 5. WR-03 live confirmation — tool_refused audit namespace
expected: Trigger a whitelist refusal during a harness run (any tool outside the active
phase's whitelist); `SELECT * FROM harness_audit WHERE run_id = <workflow_run_id> AND
event_type = 'tool_refused'` returns the refusal row (keyed to workflow_runs.id, not the
producer runs.id).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
