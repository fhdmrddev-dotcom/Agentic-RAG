---
status: partial
phase: 306-ask-the-agent-and-run-workflows
source: [306-VERIFICATION.md, 306-VALIDATION.md]
started: 2026-11-01T00:00:00Z
updated: 2026-11-01T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 8-row native roster + OpenRouter MCP ask — read-only tools only (SC#2)
expected: No execute_code / web / write / memory / skill save in any row's audit, even when the prompt asks for power tools; blocked rows recorded with a reason (Moonshot pre-marked ⛔ BUG-261024-01). Driver: `scripts/uat-306-ask-roster.py`.
result: [pending]

### 2. Burst of outside starts vs a simultaneous in-app chat (SC#5)
expected: Outside gets "try again in N s" / 429 Retry-After; the in-app chat is not slowed; with Redis down, outside starts are refused and in-app continues. Re-measure the D-35 defaults (2 per key / 4 per org / 6 per provider). Driver: `scripts/burst-306-outside-starts.py`.
result: [pending]

### 3. G-4 lived experience — MCP mark + question bubble (SC#3) and waiting-on-person link (SC#4)
expected: An MCP ask shows in thread history with "Started by AI tool key {label}" and the question bubble; a paused workflow run read over MCP shows "Waiting on {who}" with a link that opens it in the app.
result: [pending]

### 4. Client wait budget in a real MCP client (Claude Code / Cursor) (SC#1)
expected: ask_agent returns within about 30 s or returns a handle; get_answer reads it later; the same idempotency key returns the same run. Watch IN-05 (post-work after the 45 s ceiling approaches ~52 s).
result: [pending]

### 5. Live cap-pause → in-app Continue → get_answer with a folder-narrowed key (CR-01 end to end)
expected: The key gets only "This question was finished in the app…" plus the chat link, with no content or citations.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
