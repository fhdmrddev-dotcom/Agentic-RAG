---
phase: 265-owed-v4-3-verification
plan: 02
subsystem: verification
tags: [VERIFY-01, VERIFY-02, D-07, D-09, live-uat]
requirements: [VERIFY-01, VERIFY-02]
key-files:
  created:
    - .planning/phases/265-owed-v4-3-verification/265-UAT-LOG.md
    - .planning/phases/265-owed-v4-3-verification/evidence/257-row1-kpi-crop.png
  modified:
    - .planning/milestones/v4.3-phases/257-cost-in-dollars-and-what-it-cannot-see/257-VERIFICATION.md
    - .planning/milestones/v4.3-phases/258-a-tier-becomes-enforceable/258-VERIFICATION.md
    - .planning/reported-bugs/BUG-260923-02-long-lists-need-pagination.md
completed: 2026-09-24
---

# 265-02 Summary — 257 spend rows, 258 refusals, D-09 pagination, 256 pre-stop

Every row was driven live on the local stack and backed by SQL plus the API capture. **Results: 257 row 1 PASS, row 2
PASS, row 3 FAIL · 258 FAIL (a PASS, b FAIL, c FAIL) · D-09 PASS (BUG-260923-02 closed) · 256 pre-stop taken.**

| id | result | one line |
|---|---|---|
| UAT-265-257-1 | ✅ PASS | every /admin/spend figure equals independent SQL (org 22f9c615, 30 d); obs `-OBS`: the KPI says 50%, the gauge says 49% for the same ratio |
| UAT-265-257-2 | ✅ PASS | backend really stopped (curl exit 7): the Unavailable banner + Retry, 0 × `0.0k` / `0%` / `$0.0000`, no empty charts; obs `-OBS`: a HUNG backend gives an infinite boot spinner |
| UAT-265-257-3 | ❌ FAIL | emerald rated / amber unrated work on tool-using cards and the run page, but **tool-less replies never show cost** (`UAT-265-257-3-NOCARD`, 148/596 runs); the unmeasured chat state is ⛔ not observable |
| UAT-265-D09 | ✅ PASS | ledger pages 1–50 / 51–87 of 87 match SQL order; BUG-260923-02 → `closed` |
| UAT-265-258-a | ✅ PASS | the chat run is refused, and the UI names the Enterprise plan |
| UAT-265-258-b | ❌ FAIL | draft create/generate is 403 with `required_tier: enterprise`, and the UI says "Failed to generate workflow (status 403)" |
| UAT-265-258-c | ❌ FAIL | schedule Run now is 403 with `required_tier: enterprise`, and the toast says "The request was refused (status 403)" |
| 256 row 2 pre-stop | recorded | a77ed2c0: 135142 / 10317 / 4 legs; uvicorn PID 56412, started 9/20 09:00:48 |

## Fixtures (D-07, kept for re-runs)

User `uat265-standard@example.test` (`8913beee-…`) with one membership, in org `UAT-265 Standard Tier`
(`29851b83-…`, `standard`). Also a published workflow `dfa0d728-…` and a paused schedule `52b6631d-…`. The org is the
user's trigger-provisioned personal org, converted in place so the user has ONE membership (deviation). Every other
org's tier was unchanged (diff recorded).

## Deviations (all stated in the log)

1. **Execution inline by the orchestrator:** the plan needs Chrome MCP, which a gsd-executor lacks.
2. **No screenshots for most rows:** the Chrome tab stayed `document.visibilityState = hidden`, and
   `Page.captureScreenshot` timed out. Evidence is rendered text, computed colours, an in-page fetch capture (URL,
   `X-Org-Id`, status, body) and SQL. One partial zoom crop exists. This does not meet the plan's "screenshot per
   row" bar; the verdicts rest on the text, API and SQL evidence.
3. **Test-user sign-in by session swap, not a login form:** Claude does not type passwords into pages. It took a
   local GoTrue session for the fixture, swapped it in, and restored the operator's session afterwards (verified).
4. **Backend stop:** Claude's new file under `backend/` made the `--reload` backend respawn a worker that then hung.
   The operator's Ctrl+C left the parent (56412) and an orphaned worker (75208, holding :8000) alive. Claude ended
   both at the operator's explicit "kill it". The operator restarted the backend.
5. Task order was 1-row/D-09/pre-stop first (dev session present), then row 2 (stop), row 3, and 258 last.

## Triage inputs for plan 05

`UAT-265-257-1-OBS` (minor) · `UAT-265-257-2-OBS` (hung-backend spinner) · `UAT-265-257-3-NOCARD` (major) ·
`UAT-265-258-b` · `UAT-265-258-c` (the same class as R265-audit-fixes-05).

## Self-Check: PASSED
(0 password / JWT / refresh-token hits in `.planning`; all three 257 entries and the 258 entry carry
`driven:` / `result:` / `evidence:`, with their original keys unchanged)
