---
status: partial
phase: 176-chat-render-correctness-exec-reliability
source: [176-VERIFICATION.md, 176-VALIDATION.md]
started: 2026-07-23T00:00:00Z
updated: 2026-07-23T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SC#10 4-axis live UAT scoreboard
expected: Per 176-VALIDATION.md — (a) cross-provider: OpenAI + Anthropic + Google + one of DeepSeek/Moonshot/GLM, each with a single user bubble on send + a live un-folded final answer; (b) multi-tool: `execute_code` declared-library install + an undeclared-import auto-heal + a bad-name honest failure + a second same-run miss that is NOT re-attempted; (c) parallel-thread: Thread A streaming while Thread B sends, switch back to A after its terminal (un-folds, no reload); (d) long-message: ≥50 prior messages or a ≥5KB prompt per provider. Every row in the 176-VALIDATION.md SC#10 scoreboard passes.
result: [pending]

### 2. Final answer un-folds at run-end with NO reload (send path AND nav-watched backgrounded path)
expected: The narration fold gives way to a clean markdown answer at a clean terminal without reloading — on the send path and on a backgrounded/nav-watched run switched back to. (BUG-260707-03 residual; never live-confirmed before this phase.)
result: [pending]

### 3. Approve a description proposal in the Skill Studio Triggering tab
expected: The Studio header `vN` AND the Versions-tab LIVE badge both update with no reload. (BUG-260706-01.)
result: [pending]

### 4. Fresh-thread immediate send, sent several times in a row
expected: Every message lands OR restores the composer text + shows the "Couldn't send — tap to retry" hint — never a silent vanish. (RENDER-03 honesty guarantee is unit-verified; the frequency-reduction of the underlying race, D-10.1, needs a live race to observe.)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
