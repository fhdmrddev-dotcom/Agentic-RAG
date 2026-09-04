# 224-05 — SUMMARY

**Built by Claude.** All four must_haves done, plus the gate adoption folded in from `BUS-067`.

## Done

| | |
|---|---|
| **`BUG-260902-07` half 1** | `MessageItem.tsx` passes `defaultOpen={false}` — **unconditionally**. The old expression asked whether the answer had an in-range marker, and a grounded answer normally does, so the footer opened on essentially every real answer. |
| **`BUG-260902-07` half 2** | New **`FoldTrigger.tsx`** — **one component, mounted twice**, by `CitationList` and by `RunCard`'s Thinking fold. Both carried the identical buried-control defect. |
| **The Thinking default is untouched** | `useState(false)` unchanged. ⚠ Flipping it would have been a regression dressed as consistency (`224-PREFLIGHT` §3.2). |
| **`toolNames` moved into `lib/`** | Gemini's proposal, adopted: the canonical map is `@/lib/toolNames`, and `components/workflows/toolNames` is now a shim pointing the **safe** direction. Five relative importers make the shim load-bearing. |
| **The panel todo wraps by the sentence** | The row is `flex-wrap` with a `9rem` label floor, so a short label keeps its badge inline and a long one takes the width. ⚠ Widening the panel was **not available** — the measured 308 px is the `clamp(300px,…)` floor. |
| **Six suites adopted into the gate** | `Seam` 8 · `TodosSection` 12 · `CitationList` 11 · `RunCard` 29 · `RunCard.timer` 7 · `ChatArea.approval` 3. |

⭐ **Why the adoption mattered more than it looks.** The gate **ran none of these and guarded none of
them**, so this plan's own acceptance criterion (*"188/188, 0 failing"*) would have passed whether or
not four of the phase's five plans worked. Phase 214's shape again: **TARGETS decides what RUNS,
BASELINE what is GUARDED** — these sat outside both. All six were green *before* adoption, so adoption
could not red the gate, and every count was read from a real run *after* the edits landed.

## ⚠ Three things I got wrong, corrected in the code rather than quietly

1. **I widened scope and reverted it.** A first pass replaced `References · 2 sources` with a count
   chip and broke three Phase 153 tests. ⭐ **They were right** — the reported bug is the
   **affordance**, not the copy. Copy restored verbatim; the reasoning is in `CitationList`'s comment.
2. **An `aria-label` I added overrode the accessible name**, breaking the tests' role+name queries. It
   was redundant — the content already names the button. Removed.
3. **A comment I wrote was false.** It claimed `hasInRangeMarker` still gated `AbsenceHint`; `tsc`
   reported it unread. The helper is **deleted** rather than left reading as though it decides
   something, and the correction sits beside the original claim.

⚠ **The superseded Phase 153 D-06/D-07 contract is kept struck through** in `CitationList`'s docblock,
not deleted — it was deliberate, and a later phase must not "restore" it as an oversight.

## Verified

`tsc` **66** = baseline (after fixing two errors I introduced) · **75 tests green** across all seven
touched suites · count gate **OK 194/194 · pinned 6502 · total 7234 · failed 0**, and the arithmetic is
exact: **+70 = 8+12+11+29+7+3**.
