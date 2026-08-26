# Phase 208 — verification

**Date:** 2026-08-25 · **Commit:** `e6ecd9fd`
**Verdict: the ROADMAP row's stated goal is met.**

⚠ **NOT AN INDEPENDENT PASS** — executor and verifier are the same session. See *Owed*.

⚠ **This phase had no numbered success criteria.** Its ROADMAP row is a paragraph, not an SC list,
because it was escalated mid-phase by `206.2-04` rather than written by `discuss-phase`. The criteria
below are derived from that row's own wording and are named as such, not invented after the fact.

---

## Criteria, derived from the ROADMAP row

| # | Criterion (from the row) | Verdict | Evidence |
|---|---|---|---|
| 1 | **`CLAUDE.md` out of the warn band** | ✅ MET | `135,662 → 82,748` chars — **55.2%** of the 150,000 hard limit, headroom **67,252**. Gate: `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.` |
| 2 | **The audit scan list stays COMPLETE** — *"THE FIX IS NEVER A THINNER ROW"* | ✅ MET | **0 paths lost.** 113 distinct paths before, 113 after. Every G-5 verdict unchanged. The only row-count change is `115 → 113`, and both removals are **duplicates of rows that remain**. |
| 3 | **Only PROSE leaves; it moves to `docs/` under the same-commit sync rule** | ✅ MET | **115 / 115 pre-split cells present in `docs/HOT-FILE-LEDGER.md` byte-for-byte**, asserted before either file was written. The detail file's diff is **`+884 / −0`** — purely additive, so nothing there was overwritten either. Both files in the same commit. |
| 4 | **The split targets the measured mechanism** | ✅ MET | The disposition column was **60,558 chars — 45% of the file** — and is now 3,397. `## Workflow guardrails`: `87,836 → 33,507`. |

---

## The structural half (D-208-03 / D-208-04) — driven, not asserted

This is the half both previous splits skipped, and `CLAUDE.md`'s own note predicted the consequence in
writing: *"The split bought headroom; it changed nothing structural, so the trip recurs unmeasured."*
It was right — `51,171` (2026-08-17) → `135,662` (2026-08-25), **`+84,491` in eight days.**

Both guards now fail three findings. **All six firings were driven RED against planted defects:**

| finding | `check-claude-md-size.cjs` | PostToolUse hook |
|---|---|---|
| `[disposition-too-long]` (cap 200) | ✅ exit 1 | ✅ fired at **83,106** chars |
| `[duplicate-row]` | ✅ exit 1 | ✅ fired at **82,875** chars |
| `[malformed-row]` | ✅ exit 1 | ✅ fired at **82,704** chars |

⚠ **The hook figures are the point.** Every one is far **below the 120,000 warn band at which the old
hook exited silently** — which is exactly the range in which both 150k trips were actually authored.
The structural check runs BEFORE the size early-return.

After each plant `CLAUDE.md` was restored and asserted **md5-identical** (`e5a3279a8f73f8fa0b50d294b3c75cbe`
for the gate run, `70319d6ac4e9d01208b5d8d78c2cebd6` for the hook run), with both guards silent again.

---

## Three defects found by doing the work

Recorded because none was the phase's target, and nothing was watching for any of them:

1. **Two duplicate ledger rows** (Phase 206.3), each falsely claiming its file *"was ABSENT"*.
   ⚠ **A duplicate is worse than a missing row — the auditor reads the first and stops.**
2. **Stale triples on all four copies**, the newer two miscounting phases by not subtracting the
   six-digit dated quick-task buckets. Re-derived: `45 / 20 / 2621` and `22 / 9 / 1223`.
3. **Nine dead detail links and one malformed 5-cell row** that had been rendering as a broken table.

---

## One defect I introduced, and what caught it

The first slug rule stripped `_`, which GitHub's anchor algorithm keeps — every link naming an
underscored path pointed at nothing. ⚠ **My own verifier passed it**, because it computed heading
anchors with the same wrong rule on both sides. **What caught it was reading the rendered table**,
and the fix was to treat the pre-split file's 78 hand-written links as the oracle. Final: 78 taken
from the oracle, 35 generated, **0 dead**.

⚠ **A checker that shares the code-under-test's assumption cannot fail.** That is the lesson worth
keeping from this phase, more than the char count.

---

## Owed

1. **An independent verification pass.**
2. **A CI confirmation.** `.github/workflows/claude-md-size.yml` runs the same script, so it inherits
   the new checks — verified by reading the workflow, **not by watching it run**; `develop` has not
   been pushed since.
3. **The deferred items in `208-CONTEXT.md`** — the `Parallel execution` section (15,450 chars) and a
   cap on any other table, each with its re-open trigger.
