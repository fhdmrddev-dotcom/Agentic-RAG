---
phase: 269-starter-expert-library
plan: 03
subsystem: experts / starter library live proof
tags: [uat, live-evidence, experts, restricted-scope, PACK-26, PACK-27]
requires: ["269-01", "269-02"]
provides: ["evidence/00-07 live transcripts", "269-UAT-LOG.md per-Expert verdict table"]
affects: ["269-04 (operator lock/hold-back + migration 198)", "269-05 (registers, SEED-325)"]
tech-stack:
  added: []
  patterns: ["search.query document_ids -> documents.org_id/folder_id join", "all-tool-results out-of-folder scan"]
key-files:
  created:
    - .planning/phases/269-starter-expert-library/evidence/00-users-and-orgs.txt
    - .planning/phases/269-starter-expert-library/evidence/01-catalog-first-run.txt
    - .planning/phases/269-starter-expert-library/evidence/02-member-reason.txt
    - .planning/phases/269-starter-expert-library/evidence/0[3-7]-<slug>-{install,cited,refusal}.txt (15 files)
    - .planning/phases/269-starter-expert-library/269-UAT-LOG.md
  modified: []
decisions:
  - "Refusal verdicts apply the plan's full rule ('no out-of-folder document was retrieved') to EVERY tool result, not only search.query; the security-compliance refusal is therefore FAIL"
  - "A checker defect (helper regex) is corrected by re-reading the persisted answer, never by re-driving the turn"
metrics:
  duration: ~35 min (Tasks 2-3)
  completed: 2026-09-29
requirements: [PACK-26, PACK-27]
---

# Phase 269 Plan 03: Live starter-library proof Summary

Five starter Experts installed through the unchanged 266 path into one fresh enterprise-tier org, each
with a live cited answer and a sibling-corpus refusal: **14 of 15 verdicts PASS; the Security & Compliance
refusal FAILS** because `query_documents` returned a sibling-folder document outside its restricted scope.

## Task 1 (operator checkpoint — done before this executor)

- Targeted `test_269_*` (3 files): 35 passed, 0 failed.
- Full backend baseline: **71 failed, 6009 passed, 1 skipped, 2 xfailed, 2 xpassed** — at the ceiling 71, zero headroom.
- Slug bijection held (4 candidate slugs == 4 new corpora dirs; financial-analyzer pre-existing).
- HEAD at pause `b081cefd5f6ab0586db5cb9092e01293a63a0f5c`; PHASE_BASE `0300bf94260447704d5f82bde0c5d839443d9699`.
- Candidate SQL applied to the LOCAL DB by the **operator-authorized asyncpg path** ("you apply it");
  read-back 5 system rows, org_id NULL, all restricted; financial-analyzer example_output has 30.8%, no 24.3.

## Results

- **Test org:** `9042e46f-745d-40d6-83eb-c6984d582ce1` (personal org of `uat269-admin-406a18@example.test`;
  member `uat269-member-406a18@example.test` added as `member`).
- **Model / provider:** `deepseek-v4-flash` / `deepseek` (app default). **Embedding:** `text-embedding-3-small` (openai, 1536).
- **SC#1 (qualified per D-269-P1):** NULL-tier signup → `GET /experts` 403 with the tier sentence; named
  F-4 step `NULL → enterprise`; then exactly five `not_installed` cards, `can_install` true (admin) / false (member).

| slug | install | cited | refusal |
|---|---|---|---|
| financial-analyzer | PASS | PASS (checker defect corrected, see below) | PASS |
| contract-reviewer | PASS | PASS | PASS |
| hr-policy-advisor | PASS | PASS | PASS |
| security-compliance | PASS | PASS | **FAIL** — out-of-folder doc retrieved via `query_documents` |
| operations-analyst | PASS | PASS | PASS |

All 10 runs: `status completed`, `runs.org_id` == test org, `runs.expert_id` == the bundle,
`expert_attributed true`, `web_search_calls: 0`.

## Commits

- `87790d1d6` docs(269-03): fresh org, D-269-P1 tier step, first-run catalog and five 266-path installs
- `f6efce897` docs(269-03): live cited answer + sibling refusal per Expert, UAT log

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Drive-helper regex could not match `$29.1M`**
- **Found during:** Task 3 (financial-analyzer cited turn)
- **Issue:** helper regex `\$29\.1\b` fails on "$29.1M" (no word boundary between `1` and `M`), so the helper wrote `VERDICT: FAIL — literal $29.1 not in answer` although the answer contains the literal.
- **Fix:** the persisted assistant message was re-read from the DB and re-checked with `\$29\.1(?!\d)` → PASS. The turn was NOT re-driven; the Drive-table literal was not changed; the superseded helper line and the correction are both kept in `03-financial-analyzer-cited.txt`. The helper (scratchpad) was fixed before any further drive (same `\b` hazard removed from the `$2.35M` pattern).
- **Commit:** `f6efce897`

**2. [Rule 2 - Missing check] Refusal evidence measured `search.query` only**
- **Found during:** Task 3 (reading the security-compliance refusal, which named a sibling file)
- **Issue:** the plan's refusal rule is "no out-of-folder document was retrieved", but the helper only joined `search.query` document_ids; other retrieval tools (`query_documents`, `query_tables`, `grep`, `ls`, `tree`) were invisible to it.
- **Fix:** a read-only scan of EVERY tool result in all ten turns for out-of-folder document ids/filenames, appended to every cited/refusal file. Nine turns clean; the security-compliance refusal had `query_documents` return doc `297c6ee8-…` (Financial Reports & Filings) → its verdict is FAIL (superseded helper PASS line kept). `query_tables`'s echo of its own argument in a "No tables found" error is recorded as echo-only, not retrieval.
- **Commit:** `f6efce897`

## Issues for 269-04 (operator)

- **security-compliance refusal FAIL** — D-269-09 default is hold-back. The defect is platform-level
  (`query_documents` is not bounded by the Expert's restricted scope — hypothesis: `tool_dispatcher.py:978-983`
  bounds by `ctx.folder_subtree_ids`, unset for a folderless Expert thread), so it equally affects the four
  PASS Experts, whose turns just did not exercise it. Operator chooses hold-back, recorded re-drive, or a
  platform ruling. Recommend a `reported-bugs` entry.
- **G-4 screenshots OWED** — no Chrome tool in this executor; `269-UAT-LOG.md` says so. Credentials for the
  uat269 users are in the session scratchpad `state.json` (never in the repo).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: scope-bypass | backend/app/services/tool_dispatcher.py (`_handle_query_documents`) | A restricted Expert's `query_documents` SQL read a same-org sibling-folder document's id/filename/title (T-269-09 surface not covered by the plan's search.query-only mitigation). No cross-tenant read observed. Not fixed here (no code touched). |

## Known Stubs

None — evidence and log only.

## Self-Check: PASSED

- 18 evidence files + 269-UAT-LOG.md present; every install/cited/refusal file begins `slug:`/`org_id:`/`model:` and has exactly one `VERDICT:` line; cited/refusal files each have exactly one `web_search_calls:` line.
- Commits `87790d1d6` and `f6efce897` exist on `develop`.
- `git status --short -- backend/app frontend/src supabase/migrations` prints nothing.
