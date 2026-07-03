---
status: partial
phase: 136-skill-publish-gate-gate-01
source: [136-VERIFICATION.md]
started: 2026-07-03T04:45:00Z
updated: 2026-07-03T04:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Publish dialog — UNMET path (never-evaled skill)
expected: Sharing a private skill that has never been evaled opens the publish-gate dialog with an honest blocked status ("no eval has run" copy + pointer to run an eval). Force-publish (destructive styling) works and the skill becomes global.
result: [pending]

### 2. Publish dialog — MET path (passing eval)
expected: After running an eval that passes on the current skill version, sharing opens the dialog showing satisfied status ("Publish ready — eval passed X/N on the current version") and plain Publish works.
result: [pending]

### 3. Unshare never gated + re-share re-gates
expected: Unsharing a global skill is a direct toggle — no dialog, no gate. Re-sharing the same skill re-runs the gate (no grandfathering): if the gate is unmet at re-share time, the blocked dialog appears again.
result: [pending]

### 4. SkillEvalSection gate-status line + override record
expected: The eval section shows the publish-readiness line matching server state (met/unmet with honest copy). After a force-publish, the owner-visible "Published without a passing eval on <date>" record renders. Watch specifically whether the line goes stale after an in-session force-publish or newly-passing eval (code-review WR-05).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
