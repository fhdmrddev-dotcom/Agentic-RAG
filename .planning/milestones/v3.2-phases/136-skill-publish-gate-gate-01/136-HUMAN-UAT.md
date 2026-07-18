---
status: passed
phase: 136-skill-publish-gate-gate-01
source: [136-VERIFICATION.md]
started: 2026-07-03T04:45:00Z
updated: 2026-07-03T05:10:00Z
---

## Current Test

[complete — all 4 scenarios exercised live via Chrome MCP on 2026-07-03; session recorded to Downloads/skill-publish-gate-uat.gif; DB cross-checked via psycopg2 :54322]

## Tests

### 1. Publish dialog — UNMET path (never-evaled skill)
expected: Sharing a private skill that has never been evaled opens the publish-gate dialog with an honest blocked status. Force-publish works and the skill becomes global.
result: PASS — `pptx` dialog showed "This skill has never been evaled — run an eval on its current version to publish" + reason + eval pointer. Force publish anyway succeeded; card gained "Global" badge; DB row `skill_publish_overrides(pptx, never_evaled)` inserted.

### 2. Publish dialog — MET path (passing eval)
expected: Sharing a skill whose eval passed on the current version shows satisfied status and plain Publish works.
result: PASS — `docx` dialog showed "Eval passed 1/1 on the current version." with primary Publish button (no force). Publish succeeded; no override row recorded (met gate publishes cleanly).

### 3. Unshare never gated + re-share re-gates
expected: Unshare is a direct toggle with no dialog. Re-share re-runs the gate (no grandfathering).
result: PASS — unsharing `pptx` was instant (no dialog). Clicking share again reopened the blocked gate dialog despite the earlier force-publish.

### 4. SkillEvalSection gate-status line + override record
expected: Eval section shows publish readiness matching server state; after force-publish the override record renders.
result: PASS — `docx` shows "Publish ready — eval passed 1/1 on the current version"; `pptx` shows "Not publishable yet — run an eval on the current version" + reason + "Published without a passing eval on 03/07/2026". Note: in-session staleness after force-publish with the panel already open (WR-05) was not explicitly exercised; fresh panel mounts fetch correctly.

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none blocking — two operator observations routed forward:)

- **Operator-reported one-off:** "Failed to update skill." on first manual attempt to share. Not reproducible in the live session; DB shows no trace (no override row, no is_global flip from that attempt), so the request failed before server logic ran — most plausible cause: uvicorn --reload mid-restart while merged files were landing, or the enable/disable switch (identical error copy). Re-open trigger: error reappears on a settled backend.
- **Operator UX feedback (routes to Phase 137 / PANEL-01):** gate status is discoverable only inside the confirm dialog + buried in a dense edit panel; "Publish ready — eval passed 1/1" renders adjacent to "0/2 with-skill cases passed" (different metrics, no visual hierarchy) — reads as contradictory to a user. Phase 137's sketch-gated Evals panel is the designed home for this.
