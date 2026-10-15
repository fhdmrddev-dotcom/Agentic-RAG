---
status: partial
phase: 283-every-member-reaches-their-own-settings
source: [283-VERIFICATION.md, 283-LIVE-EVIDENCE.md]
started: 2026-10-15T21:43:38Z
updated: 2026-10-15T21:43:38Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Tab leaves the Chunks list in one key press (D-17, after CR-01 fix ba3aacdde)
steps: Signed in as the operator, open the Library, open "Fahed Mrad Chapters 1-4_FM_29032026.docx" (764 chunks), expand Chunks. Click once inside the chunk list (or Tab to it), then press Tab once with the browser window in front.
expected: focus moves to the next section header ("Tables"), not into a chunk. (Live drive measured 0 focusable chunk bodies after the fix; the hidden MCP tab could not deliver real key presses.)
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
