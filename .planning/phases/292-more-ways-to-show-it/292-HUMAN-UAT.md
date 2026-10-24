---
status: partial
phase: 292-more-ways-to-show-it
source: [292-VERIFICATION.md, 292-VALIDATION.md]
started: 2026-10-24T03:10:00Z
updated: 2026-10-24T03:10:00Z
---

## Current Test

Blocked on the operator restarting the backend (uvicorn --reload hung after the review-fix edits; Claude never kills or starts it). Run test 1 first once it is back.

## Tests

### 1. F-1 live re-check (plain "compare")
expected: the verbatim D-22 prompt ("Compare these two contracts on termination, liability and renewal: the Atlas Logistics MSA and the Borealis Freight MSA.") on anthropic and openai produces a `show_artifact` comparison, not only a markdown table (`scripts/run-292-board.py --g4 --scenario G4-2-comparison --providers anthropic,openai`)
result: [pending]

### 2. G4-1 diagrams in Chrome
expected: threads "292 G4-1-diagram anthropic" (a_6zmv3disqf) and "292 G4-1-diagram openai" (a_evukjb6vu0): kind chip "Flow diagram", label chip "diagram 1", no node overlap, no sideways scroll at the default column and at 343px container width, hover/focus lights exactly the node's degree of edges, dashed path count == back-edge count, captions "· 10 steps · 11 links" / "· 12 steps · 13 links"; edge labels stay inside the frame (WR-04)
result: [pending]

### 3. G4-5 diagram reloads + browser parallel-thread
expected: both diagram threads' card textContent identical before/after a page reload; a new thread A streaming the board prompt while thread B is sent — each artifact lands in its own thread
result: [pending]

### 4. 375px viewport and America/Los_Angeles timezone
expected: real 375px viewport shows no sideways page scroll on all three types; in a negative-UTC timezone timeline dates and "in N days" match the UTC-day values
result: [blocked] Chrome MCP cannot resize the maximized window or emulate a timezone; container emulation at 343px passed; dates are parsed from integer parts (unit-tested)

### 5. Operator sign-off on G4-1..G4-5
expected: the operator reviews VALIDATION §4/§6 and signs each row
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 1

## Gaps
