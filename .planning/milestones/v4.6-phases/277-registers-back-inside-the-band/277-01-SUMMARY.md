---
phase: 277-registers-back-inside-the-band
plan: 01
subsystem: planning-registers
tags: [claude-md, context-budget, hot-file-ledger, size-gate, docs-split]
requires: []
provides:
  - "CLAUDE.md at 89,171 chars (gate OK, no WARN)"
  - "docs/VITEST-COUNT-GATE.md (rule-2 history, verbatim)"
  - "FIRING-table cell cap bound at 80 in gate + hook, with floor and truncation check"
affects: [CLAUDE.md, docs/HOT-FILE-LEDGER.md, scripts/check-claude-md-size.cjs, .claude/hooks/claude-md-size-guard.js]
tech-stack:
  added: []
  patterns: ["exact-header table binding with non-vacuity floor + truncation check"]
key-files:
  created:
    - docs/VITEST-COUNT-GATE.md
  modified:
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - scripts/check-claude-md-size.cjs
    - .claude/hooks/claude-md-size-guard.js
decisions:
  - "D-03 optional moves NOT taken: the mandatory two moves alone landed CLAUDE.md at 89,171 (<= 90,000), measured with the THIRD SPLIT line already in place"
  - "Moved-cell heading sits one level below the bound section heading (### under ##, #### under ###); the heading text is the plan's fixed string"
  - "Section binding = first ##/### heading equal to the path, else first starting with `<path> `; the section ends at the next same-or-higher heading or the first deeper heading naming a DIFFERENT file"
requirements-completed: [REG-04]
metrics:
  duration: "~20 min"
  completed: 2026-10-12
  tasks: 3
  files: 5
---

# Phase 277 Plan 01: Registers back inside the band (REG-04) Summary

CLAUDE.md went from 121,650 to 89,171 chars by function, not by deletion. The 137 over-long FIRING-table verdicts moved verbatim into their ledger sections, and the rule-2 vitest history moved verbatim into `docs/VITEST-COUNT-GATE.md`. The size gate and the PostToolUse hook now bind the CLAUDE.md FIRING table by its exact header at an 80-char cap, with a 100-row floor and a truncation check. Until this commit, nothing parsed that table at all.

## Commits

| Commit | What |
|---|---|
| `0c2be7abe` | The ONE split commit (D-08 / SC#1): shortened cells, moved text, the new doc, and the gate + hook edit together |
| (this SUMMARY) | SUMMARY only, committed by path |

No per-task commits and no TDD RED/GREEN commits were made, as the plan required. The RED drive below was run against the pre-edit guards in the working tree and was not committed separately.

## Char counts per step (measured with `node scripts/check-claude-md-size.cjs` / `.length`)

| Step | CLAUDE.md chars | Delta |
|---|---|---|
| Base `11f73d932` (md5 `7ab4e6ec…` = plan base `ae2f22eed` content) | 121,650 `[WARN]` | |
| Task 1: 137 cells shortened + re-derived count line inserted | 107,329 | −14,321 |
| Task 2: three `CORRECTED 2026-10-12 (Phase 277)` lines inserted | 107,872 | +543 |
| Task 3: rule 2 moved (21,059 chars incl. CRLF), compact rule 2 (1,554), THIRD SPLIT line with `XX,XXX` | **89,171** | −18,701 |
| Placeholder filled (`89,171`, same width) | **89,171** `[OK]` | 0 |

D-03 stop check: at 89,171 (≤ 90,000) **with the THIRD SPLIT line already present**, so none of (3a) port-reservation, (3b) G-7 detail or (3c) worktree constraints was moved. `docs/LOCAL-DEV-INFRA.md`, `docs/GAP-CLOSURE-CAP.md` and `docs/WORKTREES.md` were not created.

## Final gate verdict (verbatim)

```
  CLAUDE.md                                   89171 chars   59.4% of limit  headroom   60829  [OK]

claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
gate exit=0
```

## No-loss proof (D-14), verbatim

Pre-commit (`git diff --cached -U0`):
```
NUL lines 0
mode --cached · removed 391 · moved verbatim 254 · moved as cell 137 · LOST 0
```
Post-commit (`git show -U0 HEAD`):
```
NUL lines 0
mode HEAD · removed 391 · moved verbatim 254 · moved as cell 137 · LOST 0
```

## Table self-check (Task 1, re-run on HEAD)

```
rows 202
cell1/cell2 identical 202/202
max verdict <= 80 (max 80)
faithfulness violators 0 · <=80 rows changed 0
dated headings 137 == shortened rows 137: yes
raw old cells present as whole ledger lines 137/137
scan list rows 516
NUL bytes 0
CRLF-only true
CHECK OK
```
Also: `grep -cF 'string \| null' docs/HOT-FILE-LEDGER.md` → **4** (the FilesSection.tsx escaped pipe survived as a literal). `check-hot-file-ledger.cjs --files <all 202 table paths>` → `scan list: 516 rows · subject: 202 files · watched: 198` · `ledger gate OK` (exit 0). `check-hot-file-ledger.cjs 277` → exit 0.

Count line kept, with the new one directly after it: `⚠ **RE-DERIVED 2026-10-12 (Phase 277) — the figure above (113 / 224) is stale:** this table carries **202 rows** (172 at >= 3 phases by their own triple, 30 below); the scan list carries **516** (505 plus the 11 rows 277 added for paths it lacked).`

## Drive table (D-10, SC#3)

**RED: pre-edit guards, in the working tree after Task 1 and before any gate edit**
```
| P1-gate-81-FIRING | expected NO [disposition-too-long] / exit 0 | observed silent / exit 0 | restored md5 OK | AS EXPECTED |
| P1-hook-81-FIRING | expected NO [disposition-too-long] | observed silent / exit 0 | restored md5 OK | AS EXPECTED |
```
This confirms R-1/R-2: neither guard could see an 81-char cell in the CLAUDE.md table.

**GREEN: post-edit guards, re-run on the committed tree (identical outcome pre-commit)**
```
| P1-gate-81-FIRING | expected [disposition-too-long] (cap 80) / exit 1 | observed FIRED / exit 1 — `[disposition-too-long] line 410  81 chars (cap 80)  frontend/src/components/chat/ToolCallPanel.tsx` | restored md5 OK | AS EXPECTED |
| P1-hook-81-FIRING | expected [disposition-too-long] | observed FIRED / exit 0 — `[disposition-too-long] line 410  81 chars (cap 80)  frontend/src/components/chat/ToolCallPanel.tsx` | restored md5 OK | AS EXPECTED |
| P2-gate-80-FIRING (boundary) | expected NO [disposition-too-long] | observed silent / exit 0 | restored md5 OK | AS EXPECTED |
| P3-gate-duplicate-row | expected [duplicate-row] / exit 1 | observed FIRED / exit 1 — `[duplicate-row] lines 420 + 421  backend/app/services/harness/phase_types.py — one file, one row; merge them` | restored md5 OK | AS EXPECTED |
| P4-gate-extra-cell | expected [malformed-row] expected 5 / exit 1 | observed FIRED / exit 1 — `[malformed-row] line 430  6 cells, expected 5  backend/app/models/thread.py` | restored md5 OK | AS EXPECTED |
| P5-gate-header-renamed | expected [shortlist-missing] / exit 1 | observed FIRED / exit 1 — `[shortlist-missing] CLAUDE.md  0 rows parsed (floor 100) — the cell cap would bind nothing` | restored md5 OK | AS EXPECTED |
| P5-hook-header-renamed | expected [shortlist-missing] | observed FIRED / exit 0 | restored md5 OK | AS EXPECTED |
| P6-gate-blank-after-row-50 | expected [shortlist-missing] / exit 1 | observed FIRED / exit 1 — `[shortlist-missing] CLAUDE.md  50 rows parsed (floor 100) — the cell cap would bind nothing` | restored md5 OK | AS EXPECTED |
| P6-hook-blank-after-row-50 | expected [shortlist-missing] | observed FIRED / exit 0 | restored md5 OK | AS EXPECTED |
| P7-gate-blank-after-row-150 | expected [shortlist-missing] table cut short / exit 1 | observed FIRED / exit 1 — `[shortlist-missing] CLAUDE.md  table cut short at line 560: 150 rows parsed, 52 more FIRING-shaped rows follow before th…` | restored md5 OK | AS EXPECTED |
| P7-hook-blank-after-row-150 | expected [shortlist-missing] table cut short | observed FIRED / exit 0 | restored md5 OK | AS EXPECTED |
| P8-gate-201-scan-list | expected [disposition-too-long] (cap 200) / exit 1 | observed FIRED / exit 1 — `[disposition-too-long] line 10989  201 chars (cap 200)  backend/app/services/openai_service.py` | restored md5 OK | AS EXPECTED |
| P9-gate-200-scan-list (boundary) | expected NO [disposition-too-long] | observed silent / exit 0 | restored md5 OK | AS EXPECTED |
| P10-ledger-gate-documents.py-row-removed | expected [no-row] / exit 1 | observed FIRED / exit 1 — `[no-row] backend/app/api/documents.py   (named by --files)` | restored md5 OK | AS EXPECTED |
| P10-ledger-gate-documents.py-intact | expected NO [no-row] / exit 0 | observed silent / exit 0 | no plant | AS EXPECTED |
DRIVE OK — every plant behaved as expected
```
After the post-commit drive, `git status --short -- CLAUDE.md docs scripts .claude/hooks` printed nothing. The hook exits 0 by design; the finding is carried in `additionalContext`.

## Other acceptance checks (verbatim results)

- `grep -c "LEDGER_CELL_LIMIT = 80" scripts/check-claude-md-size.cjs` → 1 · `SCAN_LIST_CELL_LIMIT = 200` → 1 · `MIN_SHORTLIST_ROWS = 100` → 1 in the gate and 1 in the hook · `Hot file (FIRING)` in the hook → 1
- `grep -c "CORRECTED 2026-10-12 (Phase 277)" CLAUDE.md` → 3; the three original 200-cap sentences are still present (→ 3)
- `CORRECTION 2026-09-22 (Phase 264, plan \`264-04\`)`: docs/VITEST-COUNT-GATE.md → 1, CLAUDE.md → 0 · `docs/VITEST-COUNT-GATE.md` in CLAUDE.md → 2 · `GSD_VITEST_MAX_WORKERS=2` → 2 · `tsconfig.app.json --noEmit` → 1
- Kept in CLAUDE.md: `check-gap-closure-rounds.cjs` → 1 · `| **G-7 Gap-closure round cap**` → 1 · `workflows/discuss-phase.md` → 1 · `71 failed, 3497 passed` → 1
- `THIRD SPLIT 2026-10-12 (Phase 277)` → 1 · `XX,XXX` → 0 · the line reads `` `121,650` → `89,171` ``, equal to the gate figure
- Sandbox: `grep -o "agentic-rag-sandbox:…" CLAUDE.md | sort | uniq -c` → `2 agentic-rag-sandbox:101.1`; `check-deploy-drift.sh` → `sandbox tag consistent everywhere: agentic-rag-sandbox:101.1` · `RESULT: PASS`
- `file` reports CRLF for CLAUDE.md, docs/HOT-FILE-LEDGER.md and docs/VITEST-COUNT-GATE.md; 0 NUL bytes in all three
- `git show --stat HEAD` lists exactly the 5 intended paths. It does not list `.mcp.json`, `.claude/settings.local.json` or `graphify-out/`
- `graphify update .` was run (33,342 nodes); `graphify-out/` was not committed

## Research corrections (R-1..R-5, as recorded by the planner and confirmed here)

- **R-1 confirmed by the RED drive:** the gate bound only the scan-list header, so it parsed 0 rows of the CLAUDE.md table. Fixed with `SHORTLIST_SPEC` (exact header, 5 cells, verdict [3], cap 80).
- **R-2 confirmed by the RED drive:** the hook bound `startsWith('| File | commits')`. Fixed with an exact `SHORTLIST_HEADER`, the same floor and the same truncation check.
- **R-3 honoured:** D-08's "lower the one constant to 80" would have turned the scan list red (428/505 cells over 80). Implemented as `LEDGER_CELL_LIMIT = 80` for the FIRING table plus `SCAN_LIST_CELL_LIMIT = 200` for the scan list, which is unchanged (P8/P9 prove both sides of the boundary).
- **R-4 confirmed:** the cells saved ~14.3k (the plan estimated 9-12k; the verdicts were kept short). Together with rule 2 that was enough, so no D-03 move was needed.
- **R-5 closed:** 11 table paths had no scan-list row. Rows added at the end of the scan list with re-derived triples (the FIRING table's triples were left untouched per D-04):

| Path | FIRING-table triple (unchanged) | Re-derived (scan-list row) | Differs |
|---|---|---|---|
| backend/app/services/harness/programmatic.py | 3 / 3 / 137 | 3 / 3 / 137 | — |
| backend/app/services/harness/emitters.py | 4 / 2 / 188 | 4 / 2 / 188 | — |
| backend/app/security/secret_cipher.py | 4 / 2 / 256 | 5 / 2 / 256 | commits |
| backend/app/services/oauth_refresh_service.py | 5 / 3 / 362 | 5 / 2 / 362 | phases (now `no (2 phases)`) |
| frontend/src/components/sources/SourceFolderPicker.tsx | 2 / 2 / 375 | 2 / 1 / 375 | phases |
| backend/app/services/provider_gateway/openai_compat.py | 6 / 4 / 525 | 6 / 4 / 525 | — |
| backend/app/services/provider_gateway/dispatcher.py | 6 / 2 / 153 | 8 / 3 / 196 | all three (now FIRES) |
| backend/app/services/provider_gateway/openai_responses.py | 0 / 0 / 563 | 1 / 1 / 563 | commits/phases |
| frontend/src/lib/api/admin.ts | 5 / 2 / 1098 | 7 / 4 / 1099 | all three (now FIRES) |
| frontend/src/components/admin/CapabilityGrid.tsx | 3 / 3 / 264 | 3 / 3 / 264 | — |
| frontend/src/components/admin/ModelAdvancedCapabilities.tsx | 0 / 0 / 290 | 1 / 1 / 290 | commits/phases |

(The recipe excludes 6-digit quick-task buckets; none of these 11 had any. The `BUG-…`-tagged commits on oauth_refresh_service / SourceFolderPicker are not numeric phase buckets, which explains the lower phase counts.)

**Observation only, not fixed:** 18 scan-list rows fire by their own triple but are absent from the CLAUDE.md FIRING table. The figure is the same at base and at HEAD:
FilterBar.tsx, AutomationGroup.tsx, DocumentFileFacts.tsx, tool-bodies/SearchDocumentsBody.tsx, lib/api/settings.ts, api/evals.py, context_window.py, todos_service.py, TodosSection.tsx, sources/import_service.py, ConnectedSourceSection.tsx, watch_service.py, db/watches.py, WatchedFoldersSection.tsx, view_filter_compiler.py, ClassificationRulesPage.tsx, ConditionPopover.tsx, pages/SetupWizard.tsx. The scan list is the authoritative set and `check-hot-file-ledger.cjs` still guards all of them; only the CLAUDE.md shortlist omits them.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Plan defect] R-6's section-binding rule bound only 85 of 137 rows**
- **Found during:** Task 1 step 5.
- **Issue:** The plan said file sections are `## ` headings, so the binding should be the first `## ` heading equal to the path. Measured: exact-match headings are at `##` (108) and at `###` (80), and 14 paths have only a `<path> — <note>` heading. A `##`-only binding left 66 rows unbound, and they would have been appended at EOF.
- **Fix:** Bind to the first `##`/`###` heading whose backtick-stripped text equals the path, falling back to the first that starts with `<path> `. The section ends at the next same-or-higher heading, or at the first deeper heading that names a DIFFERENT file. 4 `##` sections were measured to contain other files' `###` sections, and the cell must not land below those. Result: 137/137 bound (85 at `##`, 52 at `###`), 0 appended at EOF, 0 bindings with foreign sub-headings. The moved-cell heading sits one level below its section (`###` or `####`). The heading text is the plan's fixed string, and `grep -c` counts 137.
- **Commit:** `0c2be7abe`

**2. [Rule 1 - Plan self-contradiction] Count-line wording**
- **Issue:** The prescribed new line contained `` `113 of 224` ``, but the acceptance check requires `grep -c "113 of 224" CLAUDE.md` to return 1.
- **Fix:** Worded it as `the figure above (113 / 224) is stale`. The old line is untouched, and grep returns 1.
- The scan-list figure in that line is **516**, not the planner's 505, because Task 1 itself added the 11 R-5 rows. The line says so: "516 (505 plus the 11 rows 277 added)".

**3. [Rule 1] The gate's rationale comment repeated the constant assignments verbatim**
- **Issue:** This made `grep -c "LEDGER_CELL_LIMIT = 80"` and `grep -c "SCAN_LIST_CELL_LIMIT = 200"` return 2. It was caught before the commit.
- **Fix:** Reworded the comment (`capped by LEDGER_CELL_LIMIT (80…)`). Both greps now return 1.

**4. [Worktree] Base correction**
- The worktree was spawned on `8764137fe` (master), not the expected develop base. It was reset to `11f73d932` per the branch check before any work.
- At that base, CLAUDE.md, the ledger, the gate and the hook all matched the plan's `ae2f22eed` md5s, so no disagreement needed reporting.

### Not done (by rule)
- D-03 moves (3a)-(3c): not needed (see above).
- STATE.md, ROADMAP.md and REQUIREMENTS.md: not touched (orchestrator-owned, D-13).

## Known Stubs

None.

## Threat Flags

None. The changes are docs plus two local guard scripts, with no new network, auth or schema surface. T-277-01..18 were mitigated as planned, and the evidence is above.

## Self-Check: PASSED

- FOUND: docs/VITEST-COUNT-GATE.md, CLAUDE.md, docs/HOT-FILE-LEDGER.md, scripts/check-claude-md-size.cjs, .claude/hooks/claude-md-size-guard.js
- FOUND: commit `0c2be7abe` on `worktree-agent-a312d7b0fae15f144`
