---
phase: quick-261012-x1l
plan: 01
subsystem: claude-md-guardrails
tags: [claude-md, size-gate, hot-file-ledger, review-fix]
requirements: [WR-01, WR-08]
dependency_graph:
  requires: [277-REVIEW.md WR-01, WR-08]
  provides: [combined size+ledger hook context, uniform FIRING-cell ⛔ marker + legend]
  affects: [.claude/hooks/claude-md-size-guard.js, CLAUDE.md]
tech_stack:
  added: []
  patterns: [RED-first drive on scratch copies, substring-only table-cell edits keyed by path]
key_files:
  modified:
    - .claude/hooks/claude-md-size-guard.js
    - CLAUDE.md
decisions:
  - "The hook emits ONE additionalContext: the size verdict leads whenever chars >= 120000, then the ledger block, then a single Verify line. Both flags are always set."
  - "One marker (` · ⛔`) on every moved cell whose ledger text holds a ⛔ (66 rows), plus one legend line. `· see ledger` was dropped from all 24 cells."
metrics:
  duration: ~6 min (plan commit 23:52:34 -> last code commit 23:58:28 +0400)
  completed: 2026-10-12
  tasks: 2
  files: 2
---

# Quick 261012-x1l: Fix review warnings WR-01 and WR-08 (Phase 277 review) Summary

The CLAUDE.md size-guard hook now leads with `STOP — … It WILL NOT LOAD.` or `WARNING — …` even when ledger findings exist. This was proven RED and then GREEN on scratch copies. The FIRING table now carries one uniform ` · ⛔` marker on the 66 abbreviated cells whose full ledger text holds a hard constraint, plus a one-line legend. The ambiguous `· see ledger` suffix is gone.

## Commits

| Task | Commit | Files |
|---|---|---|
| 1. WR-01 hook combined context | `537c6d243` | `.claude/hooks/claude-md-size-guard.js` (1 file, +40 / −36) |
| 2. WR-08 marker + legend | `30d659415` | `CLAUDE.md` (1 file, +80 / −79) |

Each commit was verified with `git show --stat HEAD`, and each contains exactly its one file. The post-commit deletion check (`git diff --diff-filter=D HEAD~2 HEAD`) found nothing. STATE.md, ROADMAP.md, the PLAN and docs/HOT-FILE-LEDGER.md were not touched.

## Task 1 — WR-01 (TDD: RED then GREEN)

The driver is `<scratchpad>/drive-hook.cjs`, which sits outside the repo tree. Each arm gets a fresh scratch directory with an empty `.git` dir (so `isRoot` is true) and a byte copy of CLAUDE.md. Padding is appended as a trailing `## Padding (drive)` section. The long cell is a targeted substring replacement of the `ToolCallPanel.tsx` verdict with 81 `A`s, with an assertion that it is reversible exactly. The driver asserts that the real CLAUDE.md's md5 is unchanged.

**RED (unchanged hook, base e94e831cf), verbatim:**
```
Arm A (159005 chars): FAIL — first line not STOP: "HOT-FILE LEDGER — 1 structural problem(s) in C:\\Users\\fhdmr\\"; no WILL NOT LOAD; claude_md_over_limit=undefined
Arm B (125005 chars): FAIL — first line not WARNING: "HOT-FILE LEDGER — 1 structural problem(s) in C:\\Users\\fhdmr\\"; claude_md_over_limit=undefined
Arm C (89223 chars): PASS
Arm D (159033 chars): FAIL — ledger_structural_problems=undefined
Arm E (89171 chars): PASS
real CLAUDE.md md5 before=d89f995911d5366ef4ea07e56f3c1692 after=d89f995911d5366ef4ea07e56f3c1692 UNCHANGED
exit=1
```
The bug is reproduced: Arm A has no STOP and Arm B has no WARNING. **Difference from the planned RED:** Arm D also failed. Its STOP behaviour was already correct; the failure is only on `ledger_structural_problems === 0`, a field the old size-only branch never emitted. That field is part of the new contract (always a number), so D's RED is an absent-field failure, not a behaviour failure.

**GREEN (patched hook), verbatim:**
```
Arm A (159005 chars): PASS
Arm B (125005 chars): PASS
Arm C (89223 chars): PASS
Arm D (159033 chars): PASS
Arm E (89171 chars): PASS
real CLAUDE.md md5 before=d89f995911d5366ef4ea07e56f3c1692 after=d89f995911d5366ef4ea07e56f3c1692 UNCHANGED
exit=0
```
I re-ran it after Task 2 against the new CLAUDE.md and got 5/5 PASS again (md5 `06ecfcd8391aedc912eae5544a471749` unchanged). Arm A's combined context leads with `STOP — … is 159005 chars, at or over the 150000 limit. It WILL NOT LOAD.`, then `Biggest sections:`, then a blank line, then `HOT-FILE LEDGER — 1 structural problem(s) …  [disposition-too-long] line 410  81 chars (cap 80)  frontend/src/components/chat/ToolCallPanel.tsx`, then a single `Verify with:` line. Its JSON carries `claude_md_over_limit: true` and `ledger_structural_problems: 1`.

The change: the early-return ledger-only branch was replaced by `sizeLines` (only when chars >= WARN_LIMIT) and `ledgerLines` (only when structural findings exist), joined with one blank separator and one Verify line, and written once. The old branch is kept as a struck, dated `SUPERSEDED 2026-10-12 (261012-x1l / WR-01)` comment, beside the Phase 208/277 comments, which were not changed. Parsing, constants, `isRoot`, the floor and truncation are untouched (WR-02..05 are out of scope), and so is `.claude/settings.json` (IN-04). CRLF is preserved (231/231). `node --check` passes.

## Task 2 — WR-08

**Re-derived sets** (`<scratchpad>/derive-wr08.cjs`, attribution rule from the plan's interfaces block):
```
moved blocks 137 · orphans 0 · distinct keyed paths 137
FIRING rows 202
S (moved text ⛔, cell lacks ⛔): 66
  lines: 412 413 434 438 443 444 445 448 449 452 453 454 457 458 459 466 467 468 469 479 480 481 493 496 499 505 507 514 520 531 532 542 546 547 549 552 556 558 559 560 561 565 568 573 575 577 581 582 583 584 585 586 587 588 593 594 595 596 597 598 600 603 604 607 608 611
K (cell has 'see ledger'): 24
  lines: 411 412 413 432 443 453 457 463 466 471 472 512 523 540 541 545 560 595 596 598 601 602 603 606
K rows without a moved block: 0
```
- **The marker set is 66 rows, and the delta against the review's 46 is +20.** All 46 rows the review listed are in S. The 20 extra rows (412 413 443 445 453 457 466 467 481 493 505 531 532 560 595 596 598 600 603 611) are the ones the review excluded only because they carry `see ledger`, `OWED` or `FIRST`. None of those is a ⛔.
- Compared with the planning list, S has **no difference** from the planned 66 and K has **no difference** from the planned 24 (checked set-wise by `cmp-planning.cjs`). The tree had not moved since planning.
- |S ∪ K| = 79 (11 rows are in both sets). Edits were keyed by path and done by substring replacement only (no split/join re-assembly).

**After the edit:** derive gives `S: 0`, `K: 0`, `137 / 0 / 137`.

**Proof against HEAD** (`prove-wr08.cjs`; the HEAD blob is LF-normalized by autocrlf, so it was converted to CRLF for a like-for-like comparison):
```
HEAD blob LF 635 -> normalized to CRLF for comparison
rows 202->202 · changed rows 79 (S∪K 79, set-equal true) · other changed lines 0 · legend line 407
max verdict 80 · NUL 0 · CRLF 635->636 · lone LF 0->0 · chars 89171->89480
'see ledger' cells remaining: 0 · '· ⛔' cells: 66
PROVE PASS
```
- Path and triple cells are byte-identical, the order is the same, and each changed verdict equals the old verdict minus ` · see ledger` and/or plus ` · ⛔`, with nothing else changed.
- **The NUL-byte count in CLAUDE.md is 0** (`buf.includes(0)` returns false, so the check exits 0).
- The longest *changed* verdict is **74** (`ModelRegistryTab.tsx`), as planned. The overall maximum of 80 is the unchanged pre-existing `DocumentRow.tsx` cell.
- The legend sits on line 407, directly after the `⚠ **RE-DERIVED 2026-10-12 (Phase 277)…` line and before the blank line plus the FIRING header.

**docs/HOT-FILE-LEDGER.md was not edited.** Every ` · ⛔` marker points at a `CLAUDE.md verdict cell as of 2026-10-12 (moved by 277)` block that already holds the text verbatim, and every former `see ledger` row has such a block (0 without). So the same-commit sync rule is satisfied by construction. WR-07's `dispatcher.py` triple and IN-03's two cells received only the marker; their content fixes remain those findings' work.

## Gate verdicts (verbatim, final tree)

```
  CLAUDE.md                                   89480 chars   59.7% of limit  headroom   60520  [OK]

claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```
size exit=0, no WARN band.

```
hot-file ledger — 2 file(s) from the command line
  scan list: 516 rows · subject: 2 files · watched: 0
ledger gate OK — every watched file has a row.
```
ledger exit=0 (for `--files .claude/hooks/claude-md-size-guard.js CLAUDE.md`).

The PostToolUse hook, run by hand on the real CLAUDE.md after the edit, printed nothing and exited 0 (silent at about 89k with a clean table).

## Deviations from Plan

1. **[Rule 1 - harness] The first proof run compared CRLF to LF.** `git show HEAD:CLAUDE.md` returns the LF-normalized blob, so the first `prove-wr08.cjs` run flagged every line. I changed the scratch proof script to convert the blob to CRLF, with an assertion that the blob contained no CR, and re-ran it: PASS. Nothing in the repo changed because of this.
2. **The RED run had a third failing arm (D).** This is documented under Task 1: it is an absent new-contract field, not a behaviour failure. Arms A and B failed as the plan predicted.

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: .claude/hooks/claude-md-size-guard.js (in 537c6d243)
- FOUND: CLAUDE.md (in 30d659415)
- FOUND commits: 537c6d243, 30d659415
