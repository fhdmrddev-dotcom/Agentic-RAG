---
phase: 275-retention-legal-hold
reviewed: 2026-10-12
depth: standard
status: issues_found
findings:
  critical: 5
  warning: 19
  info: 16
  total: 40
parts:
  - 275-REVIEW-backend.md
  - 275-REVIEW-frontend.md
---

# Phase 275 — Code Review (index)

The phase's 65 reviewable source files were split across two fresh-context reviewers
(the 71-file scope minus generated artifacts: OpenAPI JSON, `full-schema.sql`, count-gate
pins, env examples, compose file). Findings live in the two part files; IDs are prefixed
here to keep them distinct.

| Part | Critical | Warning | Info | Headline |
|---|---|---|---|---|
| Backend + SQL (`275-REVIEW-backend.md`) — `B-` | 3 | 7 | 6 | three legal-hold bypasses: owner rename / org move lifts a hold; Storage API deletes held bytes; a released hold blocks user deletion forever |
| Frontend (`275-REVIEW-frontend.md`) — `F-` | 2 | 12 | 10 | Reload records "kept" decisions the admin never made; two refusals rendered as the opposite sentence |

Fix scope: all Critical + Warning (`/gsd:code-review 275 --fix` equivalent), backend via a
new migration 206 (204/205 are applied locally and never edited after apply).
