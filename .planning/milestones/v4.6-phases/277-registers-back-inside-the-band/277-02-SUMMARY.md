---
phase: 277-registers-back-inside-the-band
plan: 02
subsystem: planning-records
tags: [registers, v4.5-archive, bookkeeping, REG-05]
requirements-completed: [REG-05]
requires: []
provides:
  - v4.5 archive whose every SUMMARY carries a requirements key equal to its own PLAN list
  - v4.5-REQUIREMENTS.md with the glued line repaired and the 275 deploy recorded
  - v4.5-ROADMAP.md 275 progress row recording the 2026-10-12 deploy
affects: [audit-milestone cross-check (summary-extract requirements_completed)]
tech-stack:
  added: []
  patterns: [hand-edit by scratch script, one dated note per touched file, md5 reversal proof]
key-files:
  created: []
  modified:
    - .planning/milestones/v4.5-REQUIREMENTS.md
    - .planning/milestones/v4.5-ROADMAP.md
    - 19 key-less v4.5 SUMMARYs (270-01, 271-01..05, 272-01..05, 273-02, 273-05, 274-01..05, 276-01)
    - 5 v4.5 SUMMARYs whose list was [] (275-01..05)
decisions:
  - "Key is requirements-completed (M-3): the template key and the one audit-milestone extracts"
  - "Line 9 of v4.5-REQUIREMENTS.md keeps the body H1; only the glued-row prefix was removed (M-1)"
  - "v4.5-ROADMAP.md line 3 left as archived; its note says the orchestrator owns it at phase close (D-15)"
metrics:
  duration: ~25 min
  completed: 2026-10-12
  tasks: 3
  files: 26
independent_review: self
---

# Phase 277 Plan 02: Repair the v4.5 archive bookkeeping (REG-05) Summary

The v4.5 archive now says what shipped. All 24 SUMMARYs that read as unclaimed now carry a `requirements-completed` list copied verbatim from their own PLAN frontmatter. The glued traceability line in `v4.5-REQUIREMENTS.md` is gone, with its body heading kept. The 2026-10-12 deploy of 275 is recorded in both archive files. Each touched file carries exactly one dated note. Removing the repair restores each file md5-identical to base, proven on both the working-tree (CRLF) bytes and the committed (LF) blobs.

## Commits

| Commit | What |
|---|---|
| `91e913452` | `docs(277-02): repair v4.5 archive bookkeeping (REG-05)`: 26 files, 53 insertions, 8 deletions, all under `.planning/milestones/` |
| (this SUMMARY) | committed alone, by path |

There was one repair commit, as the plan specifies. Tasks 1 and 2 made no commits of their own, and no TDD split applies because no task carries `tdd`. `git show --stat HEAD` listed exactly 26 files. It did not list 273-01/273-03, `.mcp.json`, `.claude/settings.local.json` or `graphify-out/`.

## Task 1: v4.5-REQUIREMENTS.md and v4.5-ROADMAP.md

**Deploy evidence, checked BEFORE anything was written (M-8, T-277-15/16):**
- `git rev-parse --short origin/production` printed `784647e2d`
- `git log -1 --format=%s 784647e2d` printed `Merge master into production: v4.5 phase 275 Retention & Legal Hold (migrations 204-206 applied first)` (2026-10-12 18:25 +0400)
- STATE.md:67, "Owed to the operator" row 1: `~~Deploy 275~~ **DONE 2026-10-12** | prod \`784647e2d\` ... Migrations 204 → 205 → 206 applied via MCP ... Advisors 0 ERROR`. All four required substrings are present.

**M-1 heading finding:** the glued line 9 ended with the archived body's own H1 (`...|# Requirements: Milestone v4.5 Find It, Show It`). Only the prefix was stripped, and it was saved to scratch for the reversal proof. Line 9 (line 10 after the note) is now exactly `# Requirements: Milestone v4.5 Find It, Show It`.

**v4.5-REQUIREMENTS.md:** line 3's `(275 closed, not deployed)` became `(275 deployed 2026-10-12, prod \`784647e2d\`)`. One note line was inserted after the wrapper's `Audit:` line, above `---`.

**v4.5-ROADMAP.md (D-15 extended, M-9):** only the 275 progress row changed. `(prod migrations 204→205→206 + get_advisors owed; sweep stays off)` became `(LIVE 2026-10-12, prod \`784647e2d\`, migs 204→205→206 in prod, get_advisors 0 ERROR; sweep stays off)`. One note line was inserted directly after the `**Requirements:**` wrapper line. `git diff --numstat` reads `2	1`.

`check-reqs.cjs` (scratch), verbatim:
```
body identical to base: true
line 9 exact: true
no glued "|| FIND-": true
one repair note: true
line 3 deployed status: true
old status only inside note: true
reversal md5 == base: true
4 FIND + 4 RET traceability rows unchanged: true
FIND rows exact x4: true
RET rows exact x4: true
roadmap one note: true
roadmap note directly after **Requirements:** line: true
roadmap "get_advisors owed" only in note: true
roadmap 275 row replaced: true
roadmap 270/271 rows unchanged: true
roadmap line count = base + 1: true
roadmap only one other line differs: true
roadmap reversal md5 == base: true
no control bytes in edited files: true
check-reqs: ALL PASS
```

The plan's literal acceptance greps, run against the COMMITTED blobs (`check-committed.cjs`). The worktree checks files out CRLF, so `$`-anchored greps only bite on the LF blob:
```
|| FIND- (want 0): 0
^# Requirements: Milestone v4.5 Find It, Show It (want 1): 1
REQ note (want 1): 1
Archived deployed (want 1): 1
old Status wording (want 0): 0
FIND rows exact (want 4): 4
RET rows exact (want 4): 4
ROADMAP "get_advisors owed" (want 1): 1
ROADMAP 275 row (want 1): 1
ROADMAP note (want 1): 1
committed REQUIREMENTS reversal md5 == base blob: true
committed REQUIREMENTS body (from H1) == base blob body: true
committed roadmap reversal md5 == base blob: true
committed roadmap | 270. row == base: true
committed roadmap | 271. row == base: true
3	2	.planning/milestones/v4.5-REQUIREMENTS.md
2	1	.planning/milestones/v4.5-ROADMAP.md
```

### Re-verification of the already-correct rows (D-12, D-15). Nothing below was edited.

| item | record says | VERIFICATION says | match |
|---|---|---|---|
| v4.5-ROADMAP 270 row | `Complete — verified passed 4/4 (LIVE 2026-10-05)` | 270-VERIFICATION `status: passed`, `score: 4/4 success criteria verified` | match |
| v4.5-ROADMAP 271 row | `Complete — human_needed: operator G-4 sign-off + P-01/P-03 owed (LIVE 2026-10-05)` | 271-VERIFICATION `status: human_needed`, `score: 5/5 roadmap success criteria verified (code + live proofs); operator sign-off owed` | match |
| FIND-01 | `[x]` · `Complete (operator G-4 sign-off owed)` | 271 SC1 + SC3 VERIFIED; status human_needed | match |
| FIND-02 | `[x]` · `Complete (operator G-4 sign-off owed)` | 271 SC2 VERIFIED; status human_needed | match |
| FIND-03 | `[x]` · `Complete (operator G-4 sign-off owed)` | 271 SC3 VERIFIED; status human_needed | match |
| FIND-06 | `[x]` · `Complete (operator G-4 sign-off owed)` | 271 SC4 VERIFIED (G4-3); status human_needed | match |
| RET-01 | `[x]` · `Complete` | 275-VERIFICATION `status: passed`, `score: 8/8 ...`; coverage row RET-01 `✓ SATISFIED` | match |
| RET-02 | `[x]` · `Complete` | coverage row RET-02 `✓ SATISFIED` | match |
| RET-03 | `[x]` · `Complete` | coverage row RET-03 `✓ SATISFIED` | match |
| RET-04 | `[x]` · `Complete` | coverage row RET-04 `✓ SATISFIED` | match |

Note: `271-VERIFICATION.md` has no per-FIND-ID coverage table, so `grep FIND-0` finds nothing in it. The FIND verdicts above come from its five success-criteria rows (SC1 type/owner/date/custom field = FIND-01; SC2 distinct mode = FIND-02; SC3 folder/relationships/version = FIND-01/03; SC4 Classification into the Library = FIND-06). All five read VERIFIED, and the overall `human_needed` matches the records' "operator G-4 sign-off owed".

## Task 2: 19 key-less SUMMARYs

The target set was derived by scan, not taken from the plan: every v4.5 `*-SUMMARY.md` whose frontmatter has no `^requirements` key. It returned exactly 19, matching M-2. Each file got two lines after `plan:`: a YAML comment note, then `requirements-completed: <raw PLAN flow list>`. Order was kept as written in the PLAN.

## Task 3: five 275 SUMMARYs

The target set was derived by rule: a frontmatter line equal to `requirements-completed: []` and no `requirements-contributed` key. It returned exactly 275-01..05. Each file got one comment note directly above the list line, and the `[]` was replaced by its own PLAN's list. 273-01/273-03 were excluded by the rule, and their md5s are unchanged (`b976d45a…`, `ace62fc8…`).

`check-summaries.cjs --ref HEAD` (scratch). The per-file lines are trimmed here; every one read `true` on all checks, including `committed reversal==base blob`:
```
270-01-SUMMARY.md: list==PLAN true (["FIND-05","FIND-04"]) · reversal md5==base true · one note true
...
271-05-SUMMARY.md: list==PLAN true (["FIND-01","FIND-02","FIND-03","FIND-06"]) · reversal md5==base true · one note true
...
276-01-SUMMARY.md: list==PLAN true (["DOCS-04","DOCS-03","DOCS-06"]) · reversal md5==base true · one note true
inserted 19/19 OK
SUMMARYs lacking a requirements key: 0
275-01-SUMMARY.md: list==PLAN non-empty true (["RET-01","RET-02","RET-03","RET-04"]) · replaced-line reversal md5==base true · one note true
275-02-SUMMARY.md: list==PLAN non-empty true (["RET-02","RET-04"]) · replaced-line reversal md5==base true · one note true
...
replaced 5/5 OK
273-01/03 untouched: true
SUMMARYs with an empty requirements-completed and no requirements-contributed: 0
SUMMARYs carrying the repair note: 24
SUMMARYs with control bytes: 0
check-summaries: ALL PASS
```
"list==PLAN" is a deep-equality check of the GSD parser's `extractFrontmatter` output on both files (M-4: the `#` comment line is skipped and the list still parses).

## D-13: no SDK write verbs

No `milestone.complete`, `state.*`, `roadmap.update-plan-progress`, `requirements.mark-complete` or `gsd-sdk query commit` was invoked, and no `gsd-sdk` call of any kind was made. STATE.md, `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` were not touched.

## Deviations from Plan

**1. [Rule 1 - Accuracy] Last sentence of the v4.5-ROADMAP.md note reworded**
- **Found during:** Task 1
- **Issue:** The plan's note text ends with "The Status line above ... is left as archived: the D-15 extension changed only the 275 row." CONTEXT D-15 (amended at `72d16516c`) says the ORCHESTRATOR fixes line 3 at phase close. Once it does, that verbatim sentence would be false in the record.
- **Fix:** The sentence now reads: "The Status line above also predates that deploy; plan 277-02 left it as archived, because the D-15 extension gave it only the 275 row and assigns the Status line to the orchestrator at phase close." It stays true after the orchestrator's edit. Every acceptance grep is unaffected.
- **Commit:** `91e913452`

**2. [Observation] Line endings differ from M-5's measurement.** In this fresh worktree all 26 files check out CRLF (`core.autocrlf=true`, index `i/lf` for all 40 v4.5 SUMMARY/REQ/ROADMAP files). M-5's mixed LF/CRLF was measured on the main working tree. The scripts detect each file's own EOL rather than hard-coding M-5, and the index stays LF after commit (verified). Every reversal proof was run twice: on working-tree bytes against the scratch backups, and on the committed LF blobs against the base commit's blobs.

**3. [Rule 3 - Blocking, test script only]** `check-reqs.cjs`'s first run reported `4 FIND + 4 RET traceability rows unchanged: false`. The base's glued line 9 also starts `| FIND-06 |`, so the base-side filter counted 9 rows. The filter now excludes that line. This was a defect in the check, not in the edit, and the re-run read true.

## Open item for the operator / orchestrator

- **`v4.5-ROADMAP.md:3`** (wrapper Status line) still reads `**275 closed, NOT deployed** (prod migrations 204 → 205 → 206 before the backend)`. It was deliberately left as archived per D-15, which assigns it to the orchestrator at phase close. When the orchestrator fixes it, it should extend the existing single dated note (now at line 7) rather than add a second, to keep D-11's one-note-per-file rule.

## Self-Check: PASSED

- FOUND: `91e913452` in `git log` (26 files, verified with `git show --stat HEAD`)
- FOUND: all 26 modified paths, with index EOL `i/lf`
- FOUND: this SUMMARY at `.planning/phases/277-registers-back-inside-the-band/277-02-SUMMARY.md`
