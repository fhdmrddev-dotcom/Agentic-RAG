---
phase: 208-claude-md-split-by-function
plan: 01
subsystem: repo-guardrails / context-budget
tags: [claude-md, context-budget, hot-file-ledger, structural-guard, posttooluse-hook, driven-red]
authored: after-execution
requires:
  - "docs/HOT-FILE-LEDGER.md (the 2026-08-17 extraction's detail file)"
  - "scripts/check-claude-md-size.cjs (the hard gate)"
  - ".claude/hooks/claude-md-size-guard.js (the PostToolUse hook)"
provides:
  - "CLAUDE.md at 82,748 chars — 55.2% of the hard limit, 67,252 of headroom"
  - "All 115 disposition cells preserved VERBATIM in docs/HOT-FILE-LEDGER.md"
  - "A complete scan list: 113 distinct paths, every one with a resolving detail link"
  - "A structural cap on the disposition cell (200 chars), enforced by BOTH guards"
  - "The hook's structural check running BEFORE its size early-return, so it speaks at any size"
affects:
  - "CLAUDE.md"
  - "docs/HOT-FILE-LEDGER.md"
  - "scripts/check-claude-md-size.cjs"
  - ".claude/hooks/claude-md-size-guard.js"
  - ".planning/ROADMAP.md"
  - ".planning/STATE.md"
commits:
  - "e6ecd9fd — refactor(208): CLAUDE.md split — 135,662 → 82,748 chars, and this time the guard too"
---

# Phase 208 plan 01 — SUMMARY

⚠ **This summary was authored AFTER execution.** The phase ran with no `discuss-phase`, no
`plan-phase` and no `plan-checker` pass — see `208-CONTEXT.md` → *Process deviation*. Every figure
below is a measurement taken at the time, not a reconstruction.

## What shipped

| | before | after |
|---|---|---|
| `CLAUDE.md` | 135,662 chars (90.4%) | **82,748** (55.2%, headroom 67,252) |
| `## Workflow guardrails` | 87,836 | **33,507** |
| ledger disposition column | 60,558 | 3,397 |
| ledger rows | 115 (2 duplicates) | **113** |
| rows with a resolving detail link | 104 / 113 | **113 / 113** |
| `docs/HOT-FILE-LEDGER.md` | — | **+884 / −0** (purely additive) |

## 1 — the split itself

All 115 disposition cells were moved into their own file's section in `docs/HOT-FILE-LEDGER.md`,
each under a *"Disposition, moved verbatim out of the `CLAUDE.md` scan list"* block that also names
the verdict the table kept. 39 files had no section at all and got one.

**Asserted mechanically before either file was written** (`verify_split.py`):

- 115 / 115 pre-split cells present in the detail file **byte-for-byte**
- **0 paths lost** — 113 distinct before, 113 after
- every G-5 verdict unchanged
- no triple changed except the two deliberate re-derives

## 2 — three defects the split exposed

⚠ **None of these was what the phase set out to fix; all three were found by doing it.**

1. **Two DUPLICATE rows**, both added by Phase 206.3, for `harness/phase_types.py` and
   `harness/publish_service.py`, each claiming its file *"was ABSENT"* from the ledger. **Neither
   was** — both had carried a row since 193.2 / 200. ⚠ **A duplicate row is worse than a missing
   one: the auditor reads whichever comes first and stops.** Merged, with both cells preserved.
2. **Both copies of each carried a STALE triple**, and the newer ones' PHASE counts were wrong in the
   way this ledger already documents — they did not subtract the six-digit dated quick-task buckets.
   Re-derived: `phase_types.py` **`45 / 20 / 2621`**, `publish_service.py` **`22 / 9 / 1223`**.
3. **Nine rows linked to an anchor that did not exist**, and one row was **malformed** — five cells
   instead of six, so it had been rendering as a broken table.

## 3 — an anchor bug I introduced and the oracle that caught it

The first generated slug rule stripped `_`, which GitHub's heading-anchor algorithm **keeps**. Every
link naming an underscored path (`workflow_runs.py`, `anthropic_service.py`, …) pointed at nothing.

⚠ **The pre-split file was the oracle:** it carried 78 hand-written links, and the fix is to PREFER
the shipped link and generate only for rows that never had one. That also preserved
`StepCardSection.tsx`'s link, whose heading names TWO files and **cannot be generated at all**.
Final: 78 taken from the oracle, 35 generated, **0 dead**.

## 4 — the structural half (D-208-03 / D-208-04)

`scripts/check-claude-md-size.cjs` and `.claude/hooks/claude-md-size-guard.js` both now fail:

- `[disposition-too-long]` — cap **200** chars (longest legitimate verdict measured **115**)
- `[duplicate-row]` — one file, one row
- `[malformed-row]` — a row that is not 6 cells

⚠ **The hook's check runs BEFORE its size early-return.** It exited silently below 120,000 chars,
which is precisely the range in which both 150k trips were authored.

**All six firings driven RED** (three findings × two guards), each against a planted defect, with
`CLAUDE.md` restored **md5-identical** (`e5a3279a…` before and after; `70319d6a…` for the hook run)
and both guards silent again afterwards.

## Deviations from what a plan would have said

- **`.claude/hooks/claude-md-size-guard.js` was edited.** A ROADMAP row scoped to `CLAUDE.md` and
  `docs/` does not name it. It had to change, because without D-208-04 the new cap could not fire in
  the turn that authors the prose — which was the entire point of the phase.
- **The G-5 column was left factual.** `api.ts`-style rows keep `FIRES`; verdicts like `DISCHARGED`
  belong in the Disposition (the `WorkflowCard.tsx` precedent).

## What this phase did NOT do

- It did not re-derive the other 111 triples.
- It did not touch the other large narrative sections.
- **It did not run under GSD**, which is the deviation recorded at the top and in `208-CONTEXT.md`.
