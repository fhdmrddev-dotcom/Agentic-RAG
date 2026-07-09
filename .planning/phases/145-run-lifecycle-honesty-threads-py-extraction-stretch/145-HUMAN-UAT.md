---
status: partial
phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch
source: [145-VERIFICATION.md, 145-VALIDATION.md]
started: 2026-07-09T16:10:00Z
updated: 2026-07-09T16:10:00Z
---

## Current Test

[awaiting human testing — operator-driven live SC#10 UAT; needs a live browser + a mid-stream backend restart]

## Tests

### 1. Direction A self-heals with the tab open (OpenAI)
expected: Complete a run, keep the tab open, do NOT reload — the Stop button clears and the message finalizes within ~20s with no phantom "running".
result: [pending]

### 2. Direction B corrects a dead producer (DeepSeek + MiniMax)
expected: Start a stream, kill/restart the backend mid-stream — the periodic/boot sweep terminalizes the dead producer (runs.status → failed, ZREM from runs:active) within ~2400s (or sooner via the boot sweep on restart), and the Stop button reflects reality.
result: [pending]

### 3. Live Stop actually cancels a genuinely-streaming run, per provider
expected: Stop a live run on OpenAI/Anthropic/Google/DeepSeek/MiniMax/OpenRouter → runs.status='cancelled' + ZREM from runs:active. Also note (not fix) whether the cross-worker Stop gap (SEED-109 Open Q1) reproduces.
result: [pending]

### 4. Multi-tool run does not trip the watchdog/sweep
expected: A prompt using search_documents + execute_code does not get silently finalized or swept mid-run (the code_executing heartbeat keeps the stream fresh).
result: [pending]

### 5. Parallel-thread isolation
expected: Thread A streaming while Thread B accepts a new prompt — the watchdog/streamingThreads reconcile stays per-thread; A never flips B and vice versa.
result: [pending]

### 6. Long silent-reasoning gap does not false-kill
expected: An o-series / *-pro run with a >60s first-token gap — the watchdog no-ops (re-fetches, sees still-streaming) and the backend sweep does not kill it (STALE_TIMEOUT=2400s exceeds all legit silence windows). Also sanity-check the new 60s start-grace (CR-02 fix) against a slow model's real time-to-first-token.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

_(none yet — populated if a live scenario fails)_

## Notes

- HMR caveat (reference_hmr_provider_change_stale_code): the StreamsProvider change needs a FRESH page load before UAT — HMR keeps the stale module and can false-fail.
- Direction B and Stop-per-provider require restarting the dev backend mid-stream; run them when you can drive the browser + restart uvicorn yourself.
