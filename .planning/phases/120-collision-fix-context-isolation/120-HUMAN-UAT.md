---
status: partial
phase: 120-collision-fix-context-isolation
source: [120-VERIFICATION.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-22T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SC#10 4-axis live cross-provider UAT
expected: On each provider (OpenAI / Anthropic / Google / OpenRouter): run a workflow render, then a Deep skill `execute_code` in the SAME thread — exactly one file is emitted and the Deep history contains no harness-origin rows. **Multi-tool:** a post-workflow Deep turn using `search_documents` + `execute_code` emits only the new file. **Parallel-thread:** Thread A (workflow) streaming while Thread B accepts a new Deep prompt — no cross-thread baseline or origin bleed. **Long-message:** a post-workflow thread with ≥50 mixed deep+harness rows — Deep replays only deep+legacy rows and the new skill file emits cleanly. Deep Mode proven byte-identical on the native-7.
result: [pending]

### 2. Live 2-files bug confirmation (thread 99af24d5 or equivalent)
expected: Re-run thread `99af24d5` (or an equivalent reproduction: a thread that ran a workflow leaving a `.docx` in `/sandbox/output/`, then a Deep skill `execute_code` saving one file). The confirmed 2-files bug (prior workflow leftover re-emitting alongside the skill's real output) is gone — only the skill's own output file is emitted.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
