---
status: partial
phase: 121-one-front-door-for-workflows-ia
source: [121-VERIFICATION.md]
started: 2026-06-22T23:40:00Z
updated: 2026-06-22T23:40:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cross-provider workflow launch + Harness lock
expected: On OpenAI, Anthropic, Google, OpenRouter (one representative model each), launch a published workflow from the Workflows page → the thread switches to Harness mode, the 2-pill composer shows the locked placeholder ("Workflow running — Cancel to switch back") with a disabled textarea, the Stop button is reachable, and Deep chat works normally after the run completes. All 4 providers pass.
result: [pending]

### 2. Parallel-thread lock isolation
expected: Thread A runs a launched workflow (locked + streaming) while Thread B (a Deep thread) accepts a new prompt in the 2-pill composer. Thread B's composer is fully enabled (normal "Ask anything…" placeholder, non-disabled textarea, working Send); Thread A shows the locked placeholder + reachable Stop. No cross-thread lock bleed.
result: [pending]

### 3. Multi-tool launched run
expected: Launch a workflow that exercises 2+ tools (e.g. search_documents + execute_code). The 2-pill composer stays locked with the running placeholder + a reachable Stop throughout the run, and unlocks cleanly on completion.
result: [pending]

### 4. Long-message send regression guard
expected: In a Deep thread with ≥ 50 prior messages OR a ≥ 5 KB user prompt, the 2-pill composer sends normally — the send completes and a response streams back with no silent drop (must NOT regress `general-chat-intermittent-silent-send-drop`). The 2-pill composer layout is correct under load.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
