---
phase: 235-the-source-says-what-it-did
plan: 16
subsystem: source-health-surface
tags: [rendering, tdd, surf-02, gap-closure, content-not-presence]
status: complete
gap_closure: true
gap_closure_round: 1
closes: [G1a]
requires:
  - frontend/src/components/sources/sourceHealthVocabulary.ts (CHECKED_PREFIX, COUNT_ORDER, WORD_FOR_COUNT, CountKey — plan 13)
  - frontend/src/components/sources/runHistoryFold.ts (isQuiet, foldRuns — plan 04)
  - frontend/src/components/workflows/library/relativeChanged.ts (relativeBand)
provides:
  - RunHistoryList renders the per-category breakdown the BUILD-CONTRACT's renderRun specifies
  - two new emitted testids — sources-run-counts, sources-run-count-{key}
  - RunHistoryList.test.tsx §7 — ten CONTENT assertions, several whole-string
affects:
  - frontend/src/components/sources/RunHistoryList.tsx
tech-stack:
  added: []
  patterns:
    - "the words come from the vocabulary leaf; the component composes and authors nothing"
    - "separator rendered BEFORE a bit, never after — a trailing mark is unreachable by construction"
    - "countsOf() spells the six fields out so a seventh CountKey fails to compile rather than reading undefined"
    - "whole-string row assertions (rowText()) over substring probes"
key-files:
  created: []
  modified:
    - frontend/src/components/sources/RunHistoryList.tsx
    - frontend/src/components/sources/RunHistoryList.test.tsx
    - CLAUDE.md (hot-file ledger row, in place)
    - docs/HOT-FILE-LEDGER.md (same-commit sync)
decisions:
  - "The summing helper is DELETED here and KEPT in WatchedFoldersSection — a card summarises, a history itemises. That plan's diff over the sibling file is empty on purpose."
  - "Zero-valued categories are absent from the DOM, never rendered as `0 renamed`."
  - "The bits render OUTSIDE the instant branch, so an unparseable started_at loses the clock but not the facts."
  - "`count_missing = 0` on an incomplete listing is disposed of by the zero-filter — the missing bit never renders, and LISTING_INCOMPLETE_NOTE keeps saying what it always said."
metrics:
  duration: ~25 min
  tasks: 1
  completed: 2026-09-06
---

# Phase 235 Plan 16: The Run History Says What Each Check Did Summary

**Gap G1a — the closure round's BLOCKER — is closed by rendering, and nothing else.** The run history
now reads `Checked 4 min ago · 3 added · 1 updated · 2 missing at source · 1 could not be read` where
it read `Checked 4 min ago · 7 files`.

## What changed

`RunHistoryList.tsx` summed all six stored counts into one number via a local `filesTouched` helper
and rendered the total through `COPY.checkedAgo`. SC#1 asks how many files were **added**, how many
**skipped** and how many **failed**; a sum answers none of the three. It answers only *did anything
happen*, which the quiet fold already says. That is ROADMAP failure mode #3 word for word —
*"the run history shows counts but not the reason a file failed, so the one action that fixes it
cannot be chosen"* — realised inside the phase written to prevent it.

The six counts were **stored, on the wire, and already in the component's props.** They were summed on
arrival. ⛔ No endpoint, no column, no fetch was touched.

- `countsOf(run)` maps the six `count_*` fields onto the vocabulary's `CountKey`.
- `countBits(run)` walks `COUNT_ORDER`, reads `countsOf`, and **filters to `> 0`**.
- Each bit renders as `sources-run-count-{key}` — the numeral in a weight-emphasised span, the word
  from `WORD_FOR_COUNT`. The list is wrapped in `sources-run-counts`.
- The branch shape is unchanged: `isQuiet(run) ? COPY.checkedNoChange(ago) : CHECKED_PREFIX(ago)`.

## The finding worth carrying forward

⚠ **This defect shipped THROUGH A GREEN FENCE, and how it did is the more useful half.**
`sourceComposition.test.tsx` asserts that the contract's blocks are **PRESENT**, by `data-testid`.
`sources-run` and `sources-fail-reason` were present, in the contracted counts (`runCollapsed: 3` /
`runExpanded: 17`), the entire time — rendering the wrong content. **A presence assertion cannot see
content**, so a fence green by its own definition was silent about the one thing SC#1 measures.

Every one of the ten new cases asserts rendered **TEXT**, four of them against the row's **whole**
string via a `rowText()` helper. §7 opens with a comment recording exactly this reason, so the next
author does not re-derive it — and stating, as a rule, that a case which only proves an element
exists has not closed this gap and must not be written here.

## The four constraints, and how each is disposed of

| Constraint | Disposition |
|---|---|
| `0 missing` on an incomplete listing must not read as *nothing was deleted* | The **zero-filter** does it: `count_missing = 0` produces no bit at all, so the reassuring zero is unreachable. `LISTING_INCOMPLETE_NOTE` keeps rendering beside the bits, unchanged. Driven as its own case, which also asserts `sources-run-count-missing` is absent. |
| Zero-count categories must not clutter | Only `> 0` becomes a bit. A check that added three files prints one bit, not five zeroes denying the others. Asserted negatively, by word, over `COUNT_ORDER` less the one that is set. |
| Quiet folding is rendering, never storage (D-235-07) | `isQuiet` is still the ONE predicate, re-asked per row; `bits` is forced empty on the quiet arm. A quiet tick still reads `Checked 4 min ago · no changes`, asserted whole-string. |
| `COPY` pinned CLOSED | **Not re-baselined.** Nothing was added to `COPY`. `CHECKED_PREFIX`, `COUNT_ORDER` and `WORD_FOR_COUNT` are plan 13's siblings of `COPY`, not keys inside it, so the pin is undisturbed. |

⚠ **The trailing-separator trap is closed by construction, not by care.** The separator is rendered
**before** a bit, never appended after one — the first bit takes one only because there is an instant
to its left. A short or empty list therefore cannot end in a dangling mark. Driven by its own case: a
failed check with all six counts zero renders the instant and `expect(rowText()).not.toContain("·")`.

⛔ **The one-number reading survives in `WatchedFoldersSection.tsx`, deliberately.** That file keeps
its own summing helper for the source card's COLLAPSED line. A card summarises and a history
itemises — two densities over one set of facts. A comment in `RunHistoryList.tsx` says so, so the
next reader does not "finish the job" and delete a deliberate difference.
`git diff --numstat frontend/src/components/sources/WatchedFoldersSection.tsx` is **empty**.

## Measurements

| Gate | Base | After | Verdict |
|---|---|---|---|
| `RunHistoryList.test.tsx` | 18 passed | **28 passed, 0 failed** | +10 cases |
| RED proof (tests before implementation) | — | **9 failed / 19 passed (28)** | 9 of the 10 new cases red at HEAD |
| `tsc -p tsconfig.app.json --noEmit` | 66 | **66** | unchanged |
| `src/components/sources` (whole dir) | — | **16 failed / 241 passed (257)** | the 16 are `sourceComposition.test.tsx` only; 8 of 9 files pass |
| composition fence alone | `16 failed \| 33 passed (49)` | **`16 failed \| 33 passed (49)`** | **identical — not worse. NO case flipped, in either direction.** |
| repo-root count gate | `237/237 · total 7748 · pinned 6985 · failed 0` | see verbatim below | +10, exactly this plan's ten cases |
| `check-claude-md-size.cjs` | 118,308 | **118,340 chars · 78.9% · OK** | +32 chars |

**The count gate's verdict line, verbatim:**

```
  total                                      6985    7758    +773
  total 7758  ·  failed 0  ·  pinned total 6985
count gate OK — 237/237 pinned files present, no per-file decrease, 0 failing.
```

⚠ **No composition-fence case flipped green, and that is the expected result rather than a
disappointment.** The verification already classified all 16 as harness/fixture/behind-a-click
defects, none of them a missing surface — this plan changed content inside a block the fence already
found, so there was nothing there for it to newly resolve. Recorded because *"the fence is unchanged"*
is evidence about scope, and silence about it would read as an unrun check.

⚠ **`scripts/vitest-count-gate.cjs` still pins this file at 18 and was NOT edited** (the plan forbids
it, and the gate's contract is *no per-file DECREASE*). The gate is green with the pin at 18 and the
suite at 28; growth inside a pinned file is the gate working.

## Acceptance greps

| Grep | Expected | Measured |
|---|---|---|
| `grep -c "filesTouched" .../RunHistoryList.tsx` | 0 | **0** |
| `grep -n "COUNT_ORDER\|WORD_FOR_COUNT" .../RunHistoryList.tsx` | matches | **4 matches** (`:50`, `:51`, `:125`, `:204`) |
| `grep -cE '"(added\|updated\|missing at source\|could not be read)"' .../RunHistoryList.tsx` | 0 | **0** — no copy is spelled here |
| `git diff --numstat scripts/vitest-count-gate.cjs` | empty | **empty** |
| `git diff --numstat .../WatchedFoldersSection.tsx` | empty | **empty** |

All five are also pinned as executable assertions in §7's last case, so a later edit reddens rather
than waiting for a reviewer.

## Deviations from Plan

None — the plan executed exactly as written.

Two things worth naming that are not deviations:

1. **The plan's `<verification>` asks for `src/components/sources` at `0 failed`.** It measures
   `16 failed | 33 passed` in `sourceComposition.test.tsx`, which is the **inherited** red the same
   plan's next bullet pins at exactly that figure. Read together, the second bullet is the operative
   one. The other **eight** suite files in that directory pass.
2. **`Fragment` is imported from `react`** to key each bit without an extra wrapper element. A
   one-import addition, named here rather than left to a diff reader.

## Known Stubs

None. Per-**file** failure reasons (which file, and why) remain unbuilt — that is gap G1b and plan
**235-17**'s work, deliberately not started here under G-7.

## Threat Flags

None. No new network, auth, file-access or schema surface. `T-235c-09` holds: `run.last_error`
reaches JSX only as an argument to `sourceFailureSentence`, and the shipped occurrence-count fence
over this file's own source is green (`§6`).

## Self-Check: PASSED

- `frontend/src/components/sources/RunHistoryList.tsx` — FOUND (235 lines)
- `frontend/src/components/sources/RunHistoryList.test.tsx` — FOUND (28 cases, 0 failed)
- `docs/HOT-FILE-LEDGER.md` §`RunHistoryList.tsx` — FOUND, updated in the same commit as the row
- commit `049e01143` (RED tests) — FOUND
- commit `84cec3b36` (implementation + ledger) — FOUND
