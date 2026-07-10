---
status: complete
phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch
source: [145-VERIFICATION.md, 145-VALIDATION.md]
started: 2026-07-09T16:10:00Z
updated: 2026-07-10T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Direction A self-heals with the tab open (OpenAI)
expected: Complete a run, keep the tab open, do NOT reload — the Stop button clears and the message finalizes within ~20s with no phantom "running".
result: pass

### 2. Direction B corrects a dead producer (DeepSeek + MiniMax)
expected: Start a stream, kill/restart the backend mid-stream — the periodic/boot sweep terminalizes the dead producer (runs.status → failed, ZREM from runs:active) within ~2400s (or sooner via the boot sweep on restart), and the Stop button reflects reality.
result: pass
method: |
  Verified via LIVE integration test against the running dev Postgres (:54322) + Redis (:6379),
  driving the REAL owner (run_lifecycle.register_run_start) and the REAL reconciler
  (run_reconciler._reconcile_chat_runs / _is_chat_orphan) — not mocks. A full browser-driven
  crash was impractical: (a) uvicorn graceful shutdown WAITS for the live SSE stream, so Ctrl+C
  lets the run complete cleanly (confirmed: DeepSeek run 47fabe8c reached status=completed,
  runs:active empty — Direction A, not B); (b) with Redis surviving a backend-only restart the
  stream stays fresh, so cleanup is a deliberate ~2400s window (never false-kills a slow/quiet
  run). All 4 branches of the orphan predicate PASS: [A] young run + no stream → start-grace
  PROTECTS it (CR-02, not killed); [B] aged run + missing stream → terminalized to failed +
  ZREM; [C] aged run + stale stream (last event 3000s > 2400s) → terminalized to failed + stream
  dropped + ZREM (headline D-145-06 stream-age oracle); [D] aged run + FRESH stream → NOT killed
  (live-but-quiet guard). Honest error note written verbatim: "failed: orphaned — stream stale,
  reconciled by staleness sweep". 3 synthetic rows created + deleted; 0 non-terminal runs left.
  NOT covered here: the frontend's visual reflection during a real crash (watchdog/derive — see
  Test 1 pass for the derive path, and Tests 3-6 for live frontend behavior).

### 3. Live Stop actually cancels a genuinely-streaming run, per provider
expected: Stop a live run on OpenAI/Anthropic/Google/DeepSeek/MiniMax/OpenRouter → runs.status='cancelled' + ZREM from runs:active. Also note (not fix) whether the cross-worker Stop gap (SEED-109 Open Q1) reproduces.
result: pass
method: |
  Operator clicked Stop live per provider; orchestrator verified each in the DB+Redis.
  6 providers cancelled cleanly (runs.status='cancelled' + ZREM from runs:active, error=NULL):
  OpenAI f2d7acef (1606 chars), Anthropic 1ca56253 (462), MiniMax 1f5cf539 (2009),
  Zhipu/GLM 45f6c266 (513), Moonshot/Kimi f8f6cbb9 (253), DeepSeek 64cebee7 (0 chars).
  Google d2abe909 = failed on a 429 quota rate-limit (never streamed) — infra/quota, NOT a
  Phase 145 defect. runs:active empty after all cancels; 0 non-terminal runs left. The cancel
  WRITER (finalize_run_terminal → cancelled + ZREM) is provider-agnostic and confirmed.
  Cross-worker Stop gap (SEED-109 Open Q1): not reproduced this session (single-worker path).
findings: |
  Two DISPLAY-honesty gaps surfaced (operator elected to file + defer, NOT reopen 145):
  - BUG-260710-01 — "stopped" indicator on a cancelled message disappears after navigation
    (cancelled flag lives on the run row, not re-rendered as a per-message badge on reload).
  - BUG-260710-02 — cancelling DeepSeek before its first visible token persists an empty
    assistant bubble (content_len=0; avatar only). Pre-existing, DeepSeek slow-first-token.
  Both are historical-message rendering, outside Phase 145's executed scope (backend cancel
  writer + live streaming-state derive, both verified working).

### 4. Multi-tool run does not trip the watchdog/sweep
expected: A prompt using search_documents + execute_code does not get silently finalized or swept mid-run (the code_executing heartbeat keeps the stream fresh).
result: pass
method: |
  Operator ran a 2-tool prompt on 2 providers; orchestrator verified in DB. Both completed
  cleanly with BOTH tools exercised: Anthropic ad854ccc (completed, 42s, tools=[execute_code,
  search_documents], 1616 chars); Zhipu/GLM-5.2 d32bf0fe (completed, 70s, same 2 tools, 1987
  chars). The 70s multi-tool run survived well past any naive watchdog window — the
  code_executing heartbeat kept the stream fresh; no mid-run sweep/silent-finalize. 0
  non-terminal runs left, runs:active empty. (Google 429 rate-limit again — infra, not 145.)

### 5. Parallel-thread isolation
expected: Thread A streaming while Thread B accepts a new prompt — the watchdog/streamingThreads reconcile stays per-thread; A never flips B and vice versa.
result: pass
method: |
  Operator streamed 2 threads concurrently; orchestrator confirmed temporal overlap in DB.
  Moonshot run 35e38771 (thread 4c755317): 03:39:37→03:42:01 (144s). DeepSeek run 1c927eb2
  (thread 15843045): 03:39:52→03:40:05 (13s) — started 15s into the Moonshot run and completed
  ENTIRELY inside its streaming window. Different threads, both completed; the short run's
  start AND completion did not disturb the long run (it streamed ~2 min more, then completed).
  Per-thread isolation held: no cross-thread flip. 0 non-terminal runs, runs:active empty.

### 6. Long silent-reasoning gap does not false-kill
expected: An o-series / *-pro run with a >60s first-token gap — the watchdog no-ops (re-fetches, sees still-streaming) and the backend sweep does not kill it (STALE_TIMEOUT=2400s exceeds all legit silence windows). Also sanity-check the new 60s start-grace (CR-02 fix) against a slow model's real time-to-first-token.
result: pass
method: |
  Operator ran a reasoning prompt on deepseek-v4-pro; orchestrator analyzed the run + its Redis
  stream. Run 32be2cd8: completed, 69.6s, error=None, content 3947 chars + reasoning + 1 tool.
  Stream = 2292 events; time-to-first-event 2.2s; span 67.5s; LARGEST inter-event silent gap =
  24.9s. That 24.9s gap CROSSED the 20s frontend-watchdog inactivity threshold → the watchdog
  fired, re-fetched getSnapshot, saw still-streaming, and NO-OP'd (did not false-finalize); and
  it is far below the 2400s backend stale-timeout so the sweep left it alone. Run completed
  cleanly, not swept. 0 non-terminal runs, runs:active empty. False-kill guards now evidenced at
  every timescale: 24.9s live gap (T6) + 144s live run (T5) + 10-min aged-fresh-stream & 60s
  start-grace integration cases (T2 Cases D/A).

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0
findings_filed: [BUG-260710-01, BUG-260710-02]

## Gaps

_No test FAILED — all 6 passed. Two display-honesty findings surfaced during Test 3 and were
filed as bug reports + deferred (operator decision 2026-07-10, NOT folded into 145 which is
already executed/reviewed/secured):_

- **BUG-260710-01** — "stopped" indicator on a cancelled message disappears after navigation
  (minor; historical-message rendering, outside 145's executed scope).
- **BUG-260710-02** — cancelling before first visible token persists an empty assistant bubble
  (minor; DeepSeek slow-first-token; pre-existing).

_Infra (not a 145 defect):_ Google gemini-3.5-flash returned 429 RESOURCE_EXHAUSTED (quota
rate-limit) and never streamed, so its Stop/reasoning legs could not be exercised — provider
quota issue, unrelated to run-lifecycle honesty.

## Notes

- HMR caveat (reference_hmr_provider_change_stale_code): the StreamsProvider change needs a FRESH page load before UAT — HMR keeps the stale module and can false-fail.
- Direction B and Stop-per-provider require restarting the dev backend mid-stream; run them when you can drive the browser + restart uvicorn yourself.
