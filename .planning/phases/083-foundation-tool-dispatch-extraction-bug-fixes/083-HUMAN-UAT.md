---
status: partial
phase: 083-foundation-tool-dispatch-extraction-bug-fixes
source: [083-VERIFICATION.md]
started: 2026-05-28T02:30:00Z
updated: 2026-05-28T04:15:00Z
---

## Current Test

Kimi full run tested (2026-05-28)

## Tests

### 1. Kimi/Moonshot thinking filter (BUG-260526-02)
expected: Send a message to Kimi/Moonshot; thinking content appears in collapsible thinking panel, NOT in visible chat text
result: PASS — no leakage of thinking content into visible chat

### 2. Title generation cross-provider (BUG-260527-01)
expected: New chats on DeepSeek, Moonshot, MiniMax, GLM, and Google produce meaningful 4-6 word titles (not "New Chat" or single-word truncations)
result: [pending] — not yet tested on all 5 providers

### 3. Output files after page reload (BUG-260526-03)
expected: Run agent with sandbox that produces output files; reload page; files visible in Final Outputs panel without expanding tool panel
result: PASS — final output section is persistent. Minor cosmetic: file sizes disappear after a few seconds.

### 4. Timer stability mid-cycle (BUG-260526-04)
expected: Watch timer during full agent run cycle; timer stays visible continuously without disappearing when temp-id swaps to DB UUID
result: PARTIAL — timer still disappears during long-running Kimi cycles (after some time, not on temp-id swap). Agent indicators like "Analyzing document..." still visible. Pre-existing issue beyond the scope of the temp-id key fix.

## Summary

total: 4
passed: 2
issues: 1
pending: 1
skipped: 0
blocked: 0

## Gaps

### Observations from Kimi full-run test (not Phase 083 regressions)

1. **Timer disappears on long runs** — Timer above chat disappears after some time on Kimi. Different root cause from the temp-id swap fix (BUG-260526-04). Agent status indicators ("Analyzing document...") still visible. Affects long-running multi-step tasks.

2. **Step count mismatch** — Step count on timer does not match step count on tool panel header. Likely a counter synchronization issue between the RunCard timer and ToolCallPanel header.

3. **Non-Anthropic code generation task descriptions are generic** — During execute_code, non-Anthropic providers show generic task descriptions instead of specific ones (e.g., "Generating code" vs Anthropic's "generating slides 1-6, generating charts"). This is a tool_args_progress SSE event parsing difference across providers.

4. **File sizes in final output disappear** — In the final output section at bottom of chat, file sizes appear briefly then disappear after a few seconds. Cosmetic issue.
