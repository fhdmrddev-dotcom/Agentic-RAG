---
status: partial
phase: 091-harness-engine-5-phase-types-gates-whitelist
source: [091-VERIFICATION.md]
started: 2026-05-31
updated: 2026-05-31
blocked_on: "Phase 092 (dual-mode + Continue) — no UI/API entry point to START a workflow exists in 091 (no INSERT INTO workflow_runs in backend/app); these live cross-provider UAT rows cannot be exercised until 092 wires the workflow trigger. Phase 096 (EVAL-02) is the live kill-and-resume proof gate."
---

## Current Test

[awaiting Phase 092 workflow-trigger entry point before these can be run]

## Tests

### 1. Cross-provider workflow UAT (SC#10 axis 1 — cross-provider)
expected: Run the `plan_execute_verify` seed workflow on each of the 6 native providers (OpenAI, Anthropic, Google, DeepSeek, Moonshot, GLM/MiniMax representative) via Chrome MCP. For each: tool refusals outside the phase whitelist return a clean tool_result (no provider 400), gate_failed/gate_passed events fire, the final phase output becomes the chat message, and the per-provider tool budget cap (Google max_tools=16) is respected.
result: [pending — blocked on 092 trigger]

### 2. Parallel-thread isolation (SC#10 axis 3 — parallel-thread)
expected: Thread A running a workflow does not lock Thread B's composer or mode toggle; Thread B accepts a new prompt while A streams.
result: [pending — blocked on 092 trigger]

### 3. Long-message UAT (SC#10 axis 4 — long-message)
expected: A workflow completes correctly with ≥50 prior messages in the thread (or a ≥5 KB user prompt), no truncation/desync of the final-output-as-chat-message.
result: [pending — blocked on 092 trigger]

### 4. ask_user restart smoke (resumability — live)
expected: A workflow paused mid-`ask_user` re-appears with its prompt after a uvicorn restart (subscribe-before-emit holds; answered prompts are not re-asked). Full kill-and-resume cross-worker proof is owned by Phase 096 (EVAL-02).
result: [pending — blocked on 092 trigger]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 4

## Gaps
