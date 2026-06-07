---
status: complete
phase: 096-eval-harness-cross-provider-verification-concurrency
source: [096-VERIFICATION.md, 096-REVIEW-FIX.md]
started: 2026-06-07T22:30:00Z
updated: 2026-06-07T09:05:00Z
---

## Current Test

[testing complete]

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
result: pass
notes: |
  Full --workflow run 2026-06-07: 6/7 native PASS + openrouter best-effort PASS.
  google initially FAILED — root cause: depleted Google AI Studio prepaid credits
  (429 RESOURCE_EXHAUSTED, billing, not a harness defect; harness recorded the
  failure honestly in phase outputs, run 69555079). After operator credit top-up,
  same-day re-run `--workflow --provider google`: PASS all checks (run 47f5a122,
  5/5 phases completed, 156.8s, DB-verified). Effective result: 7/7 native PASS.
  D-04 capability table (JSON+MD) committed at 6e230ae9 with provenance note —
  google row carries measured re-run values.

### 2. Restart smoke — 3 kill points (EVAL-02 / D-08 / SC#2 / SC#4)
expected: With backend running, `scripts/restart_smoke.py --kill-at programmatic` (then
`llm_agent`, then `ask_user`): script prints SMOKE_KILL banner, operator kills + restarts
uvicorn, script detects restart via /health and asserts DB truth — no_skipped_phases PASS,
single_completion_audit PASS (WR-01 normalization now applied), no_duplicate_subagents PASS.
The ask_user leg additionally asserts prompt_reemitted + answer-after-restart completion
(BUG-260605-01 live verification).
result: issue
reported: "SMOKE_RESULT programmatic FAIL — SMOKE_ASSERT run_completed FAIL workflow_runs.status=failed; no_skipped_phases FAIL split=active, fanout/deep_dive/confirm/summarize=pending; single_completion_audit PASS; no_duplicate_subagents FAIL sub_questions=0 sub_run_ids=0. Operator kill+restart executed correctly (SMOKE_DOWN/SMOKE_UP both detected)."
severity: blocker
notes: |
  Legs llm_agent + ask_user NOT run — same root cause would fail them identically
  (shared kill mechanism). All 3 legs must re-run after the fix.

### 3. 4-axis UAT scoreboard (SC#10)
expected: Cross-provider × multi-tool × parallel-thread × long-message rows per
096-VALIDATION.md, including the ≥6-run stream-cap scenario (SC#5: LRU-3 pool evicts
oldest, honest background indicators per D-10, snapshot-then-replay on return per D-11,
no 15-30s thread-switch hang) and the D-11a honest-indicator confirmation.
result: issue
reported: "Cross-provider PASS (7/7 via Test 1). Multi-tool PASS on 7 providers (google made 14 calls but never ran execute_code — known-degraded, datapoint not defect). Parallel-thread basic PASS. STREAM-CAP ≥6 runs surfaced defects: 2 runs wedged 40+ min inside execute_code with no auto-timeout and no Stop button; deepseek Redis-read-timeout under load; heavy PC contention; slow reconcile on switch (self-healed). Long-message not yet run (machine overloaded)."
severity: blocker
row_progress: |
  - Cross-provider: PASS (satisfied by Test 1 — 7/7 EVAL_ROW PASS).
  - Multi-tool: PASS — live operator runs, DB tool_calls cross-checked. Both
    tools (search_documents + execute_code) in one run on openai gpt-5.4-mini
    (29.1s), anthropic claude-haiku-4-5 (24.3s), deepseek (30.3s, + remember),
    minimax M2.7 (58.8s), zhipu glm-5.1 (85.8s), moonshot kimi-k2.6 (82.9s),
    openrouter llama-3.3-70b (38.8s, best-effort). EXCEPTION: google
    gemini-3.5-flash made 14 tool calls (write_todos, search/query/grep/read
    loop, 180k input tokens) but NEVER invoked execute_code and finished with
    todos at 1/3 complete — honest UI throughout, run completed. Recorded as
    provider-behavior datapoint (D-03 google known-degraded class; feeds v2.9
    feature-fit routing), NOT a 096 defect. Row requirement (1 flagship +
    1 non-OpenAI native) satisfied 6x over.
  - Parallel-thread (basic): PASS — operator confirmed B not blocked while A
    streamed; DB proof of true simultaneity from earlier zhipu+moonshot
    multi-tool runs (both started 07:53:02, streamed ~83-86s concurrently,
    both completed, no cross-thread bleed).
  - Stream-cap >=6 runs + D-11a: ISSUE (see gap test=3). Operator ran ~6-7
    concurrent chats with a heavy execute_code prompt (sort benchmark on up to
    8M ints). Surfaced TWO genuine defects + load-contention casualties:
    (1) BLOCKER execute_code has NO wall-clock timeout — 2 runs (anthropic
    haiku 09694697, openrouter llama 394644e1) stuck INSIDE execute_code for
    40+ min (Redis heartbeat elapsed_seconds=2445/2402, producers ALIVE, runs
    never terminalize). Model wrote effectively-non-terminating computation;
    nothing kills it. (2) BLOCKER/MAJOR no Stop affordance on these
    backgrounded runs — operator had no UI way to stop them. Backend DELETE
    /runs/{id} cancel path EXISTS and works; UI just doesn't render the button
    for capped-out/backgrounded threads. Casualties under load: deepseek
    failed with "Timeout reading from localhost:6379" (Redis socket_timeout
    exceeded under contention); slowness + "new chat hung" + "3 chats empty
    then loaded correctly" = reconcile/snapshot latency under starved
    threadpool (self-healed, no data loss — reinforces Test 4 cross_tab
    finding); PC pegged = 6 Docker sandboxes (≥2 runaway) + 6 streams.
    Honest-UI behaviors (D-10/D-11a) NOT contradicted: todos showed real
    incomplete state, no fake activity observed.
  - Long-message: pending (deferred — machine overloaded; re-run after relief)
  Expected-model-variance (NOT defects): truncation notice on moonshot
  kimi-k2.6 (output=8550) + minimax M3 (output=8192, both at max_output_tokens
  cap) — honest truncation surfacing; write_todos is model-discretionary
  (gpt-5.5 3x, kimi 3x, minimax M3 0x — prompt didn't mandate planning).

### 4. N=10 concurrency probe (CONC-01 / SC#3)
expected: `scripts/conc_probe.py` emits PROBE_ASSERT fanout_bounded PASS (max overlap ≤
live max_parallel_agents, total == 10), PROBE_ASSERT cross_tab_latency PASS (p95 < 50ms),
and a PROBE_BUDGET total/peak_borrowed reading recorded for SEED-036a AnyIO sizing.
result: issue
reported: "PROBE_RESULT FAIL — fanout_bounded PASS (sub_runs=10, max_overlap=5 ≤ 5) but cross_tab_latency FAIL: snapshot n=20 p50=56.8ms p95=8563.9ms max=9587.4ms errors=1; list n=21 p50=40.0ms p95=2644.2ms max=5803.8ms. PROBE_BUDGET total=200 peak_borrowed=5. PROBE_PEAKS redis_active_runs=1 postgres_pool_in_use=0 per_worker_run_count=1. Workflow itself completed."
severity: major
notes: |
  PROBE_BUDGET reading (total=200 peak_borrowed=5) IS captured — the SC#3
  documented-reading deliverable itself is met, and threadpool starvation is
  ruled out (5/200 borrowed). The failure is the cross-tab latency budget:
  p95 170x over 50ms while a fan-out streams. Environment caveat: backend ran
  single-worker (`--reload` dev mode), not the documented WORKER_COUNT=2
  default — diagnosis must split "event-loop blocking (sync I/O in async
  path)" from "single-worker dev artifact".

### 5. WR-03 live confirmation — tool_refused audit namespace
expected: Trigger a whitelist refusal during a harness run (any tool outside the active
phase's whitelist); `SELECT * FROM harness_audit WHERE run_id = <workflow_run_id> AND
event_type = 'tool_refused'` returns the refusal row (keyed to workflow_runs.id, not the
producer runs.id).
result: pass
notes: |
  Live-triggered via bait kickoff prompt instructing sub-agents to call the
  unadvertised execute_code tool. zhipu + openai (round 1) resisted the bait;
  minimax emitted execute_code 4x during the fanout phase — all 4 refused by
  the dispatch backstop and audited as tool_refused rows keyed to
  workflow_runs.id 7a74c9fc-ce3f-4f28-af77-55deae2d4ba1 (metadata
  tool=execute_code, allowed=["search_documents"]). Negative control: 0
  tool_refused rows in any other run namespace in the window. Workflow still
  completed (refusal is a clean tool-result, not a crash). 2026-06-07.

## Summary

total: 5
passed: 2
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Backend kill+restart at any of the 3 kill points resumes the workflow — no_skipped_phases PASS, single_completion_audit PASS, no_duplicate_subagents PASS; ask_user leg re-emits the pending prompt and completes after the answer (BUG-260605-01)"
  status: failed
  reason: "User reported: SMOKE_RESULT programmatic FAIL — workflow_runs.status=failed, split=active with all later phases pending, resume sweep never claimed the run (claimed_at=None)"
  severity: blocker
  test: 2
  root_cause: "Graceful Ctrl+C shutdown defeats restart resumability: uvicorn lifespan shutdown propagates CancelledError into the harness producer task; the shielded finalizer's Phase 092-05 F2 backstop (backend/app/api/threads.py:1531-1546) fires on ANY non-completed terminal status — including 'cancelled' caused by app shutdown — and terminalizes workflow_runs to 'failed'. The boot-time resume_stranded_workflows sweep only claims NON-terminal runs, so the run is never resumed. Evidence: workflow_run 432bb144-7fd7-47e0-8707-80ec33522906 flipped to failed at 07:15:46Z (the Ctrl+C moment, BEFORE the restart), claimed_at=None, phase 0 'split' left 'active', only 1 audit row (phase_started). F2 remains CORRECT for user-Stop/crash/timeout while the app stays alive — the harness_engine cancel-path comment ('the process-death case runs no code here by definition', harness_engine.py:843) only anticipated hard kills, not graceful SIGINT/SIGTERM, which production deploys/restarts also use."
  artifacts:
    - path: "backend/app/api/threads.py"
      issue: "F2 backstop (~1519-1546) terminalizes workflow_runs to 'failed' on lifespan-shutdown cancellation, destroying restart resumability for harness runs"
  missing:
    - "Distinguish app-shutdown cancellation from user-Stop/crash/timeout in the producer finalizer (e.g., a lifespan shutting_down flag checked before F2); on shutdown, leave workflow_runs non-terminal/claimed so resume_stranded_workflows claims it on next boot"
    - "Ensure the runs-row terminal write for shutdown-cancelled harness producers stays consistent with whatever state the sweep expects to re-claim"
    - "Re-run all 3 restart-smoke legs (programmatic, llm_agent, ask_user) live after the fix"
  debug_session: ""

- truth: "While an N=10 fan-out streams, an idle second thread stays responsive — p95 of GET /threads/{idle}/snapshot and GET /threads < 50ms (CONC-01 / SC#3)"
  status: failed
  reason: "User-run probe: cross_tab_latency FAIL — snapshot p95=8563.9ms max=9587.4ms errors=1; list p95=2644.2ms max=5803.8ms (budget 50ms). fanout_bounded PASS; PROBE_BUDGET total=200 peak_borrowed=5 rules out threadpool starvation."
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing:
    - "Identify what blocks request serving during fan-out streaming (event-loop blocking sync I/O in async handlers per D-v2.5-01, lock contention, or single-worker dev artifact — probe ran under --reload single worker, not WORKER_COUNT=2)"
    - "Re-run scripts/conc_probe.py after fix: cross_tab_latency PASS p95 < 50ms"
  debug_session: ""

- truth: "A model-issued execute_code that runs unbounded is killed by a wall-clock timeout so the run terminalizes; the user can always Stop an in-flight run from the UI"
  status: failed
  reason: "User stress test (≥6 concurrent heavy execute_code chats): 2 runs (anthropic claude-haiku-4-5 run 09694697, openrouter llama-3.3-70b run 394644e1) stuck INSIDE execute_code 40+ min, producers alive (Redis heartbeat elapsed_seconds=2445/2402 still ticking), runs never reach terminal status; operator had NO Stop button to halt them."
  severity: blocker
  test: 3
  root_cause: "execute_code handler (backend/app/services/tool_dispatcher.py:589-672) runs session.execute_command in loop.run_in_executor with NO timeout and awaits `fut` unbounded — no asyncio.wait_for, no sandbox-side wall-clock cap. The per-model llm_call_timeout_seconds (config.py) bounds LLM calls, NOT tool execution. A model that writes a non-terminating / O(n^2)-on-8M-elements computation (plausible from the sort-benchmark prompt), especially under heavy multi-container contention, runs effectively forever; the producer stays in 'streaming', holds a thread-executor slot, and the run is wedged with no auto-recovery. Compounding UI gap: backgrounded/capped-out runs (outside the LRU-3 stream pool) render no Stop control, so DELETE /runs/{id} (which works — runs.py:1014-1102) is unreachable from the UI for exactly the runs most likely to wedge."
  artifacts:
    - path: "backend/app/services/tool_dispatcher.py"
      issue: "_handle_execute_code awaits the sandbox executor future with no wall-clock timeout (~603/672) — runaway code never auto-killed"
    - path: "frontend (run-status strip / ToolCallPanel / StreamsProvider)"
      issue: "no Stop affordance rendered for backgrounded/capped-out active runs — user cannot reach the working DELETE /runs/{id} cancel path"
  missing:
    - "Add a configurable per-call execute_code wall-clock timeout (sandbox-side and/or asyncio.wait_for around the executor future); on expiry, return a tool-result error and let the run continue/terminalize cleanly — never wedge"
    - "Surface a Stop control for ANY in-flight run regardless of LRU-3 stream-pool membership (the run-status strip must offer Stop for backgrounded runs)"
    - "Decide intended behavior under N≥6 heavy concurrent sandboxes (queue/cap sandbox concurrency vs. let contention degrade) — relates to SEED-036a sizing + the Test 4 cross_tab_latency finding"
    - "Re-run the stream-cap ≥6 scenario after fixes: no wedged runs, Stop always available, p95 thread-switch <1s"
  debug_session: ""

- truth: "Under heavy concurrent load the platform degrades gracefully — no user-facing Redis/transport errors, thread-switch reconcile stays responsive"
  status: failed
  reason: "User reported deepseek-v4-pro chat showed 'timeout error, please try again'; DB: run failed at 36.5s with 'failed: TimeoutError: Timeout reading from localhost:6379'. Also: 'new chat hung' after the 4th chat and 3 chats rendered empty before loading correctly after a delay (self-healed) — reconcile/snapshot latency under a starved threadpool."
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing:
    - "Determine why a Redis read hit socket_timeout under load (connection pool exhaustion, blocking call on the event loop, or genuine Redis saturation) and whether it correlates with the same sandbox/threadpool contention as the execute_code wedge and Test 4 cross_tab_latency FAIL"
    - "Confirm whether the empty-then-loaded chats are purely latency (no data loss) — reconcile-on-switch correctness under load"
    - "Separate true defects from dev-box-overload artifacts: re-test on WORKER_COUNT=2 (production default) without --reload, fewer simultaneous heavy sandboxes"
  debug_session: ""
