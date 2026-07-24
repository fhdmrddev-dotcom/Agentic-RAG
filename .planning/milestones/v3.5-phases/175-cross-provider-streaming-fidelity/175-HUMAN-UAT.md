---
status: partial
phase: 175-cross-provider-streaming-fidelity
source: [175-VERIFICATION.md]
started: 2026-07-22T18:30:00Z
updated: 2026-07-22T18:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. gpt-5.6-class model + tool prompt in Deep chat (real OpenAI endpoint)
expected: Run completes with no 400; reasoning stays on; tools execute via STRUCTURED/XML path
result: [pending]

### 2. gpt-5.6 Deep chat with 2+ tools in one prompt (e.g. search_documents + execute_code)
expected: Both tools execute correctly via the STRUCTURED XML-injection path, no 400
result: [pending]

### 3. A long DeepSeek turn (~26+ tool calls) that naturally triggers the DSML leak
expected: No dirty `<｜｜DSML｜｜...>` markup rendered in the chat; if a leak occurs, the honest notice appears inline and persists after reload/reconnect (CR-01 fix — delta, not terminal error)
result: [pending]

### 4. Thread A streaming a long DeepSeek turn while Thread B accepts a new prompt (title-gen fires)
expected: No cross-thread interference; Thread B's title-gen resolves independently while Thread A keeps streaming
result: [pending]

### 5. First message on each SAFE reasoning provider (DeepSeek / Kimi-k2.6 / GLM-5.2) produces a real 4-6 word title; Google gemini-3.x and MiniMax-M2.x (UNSAFE) still derive a title with no regression
expected: SAFE providers show a real generated title (not the degenerate first-few-words fallback); UNSAFE providers show the existing derived title unchanged
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
