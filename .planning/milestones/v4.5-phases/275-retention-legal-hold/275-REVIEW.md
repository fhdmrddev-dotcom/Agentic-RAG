---
phase: 275-retention-legal-hold
reviewed: 2026-10-12
depth: standard
status: fixed
fixed_at: 2026-10-12
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

## Fix status (2026-10-12)

| Part | Critical | Warning | Info | Where |
|---|---|---|---|---|
| Backend `B-` | 3/3 fixed | 7/7 fixed | 2 fixed (IN-04, IN-05) · 4 skipped (IN-01/02/03/06) | migration 206 + Python; `275-REVIEW-backend.md` § Fix pass |
| Frontend `F-` | 2/2 fixed | 12/12 fixed | 6 fixed · 3 partly (IN-06/07/08) · 1 recorded (IN-02) | 19 commits `ca9542133..1acbfd61c`; `275-REVIEW-frontend.md` § Fix pass |

Every fix was driven RED first. Gates after both passes:
- backend `71 failed / 7159 passed`, failed SET = base (backend fixer); frontend pass changed no backend file
- `total 10184 · failed 0 · pinned total 9397` — `count gate OK — 434/434`
- `tsc -p tsconfig.app.json` 66 errors = base, set diff empty
- ledger gate OK; claude-md size gate OK WITH WARNINGS (past 120k — split due)

Open from review, by decision: B-IN-01/02/03/06, F-IN-02, the partial halves of F-IN-06/07/08.
No re-review round was run: G-7 — the fixes are verified by their own RED→GREEN cases and the verifier reads the code next.

