---
phase: 283-every-member-reaches-their-own-settings
plan: 03
subsystem: frontend / document detail panel
tags: [document-detail-panel, chunks, bounded-list, a11y, scroll-region, tdd, bug-260908-01]
requirements: [FIX-08]
dependency_graph:
  requires: []
  provides: ["bounded, labelled, one-Tab-stop chunk-list region in DocumentChunksSection"]
  affects: ["DocumentDetailPanel (unchanged; the bound lives in the child)"]
tech-stack:
  added: []
  patterns: ["role=region + tabIndex 0 scroll container with a justified jsx-a11y/no-noninteractive-tabindex disable (WCAG 2.1.1)"]
key-files:
  created: []
  modified:
    - frontend/src/components/metadata/DocumentChunksSection.tsx
    - frontend/src/components/metadata/__tests__/DetailSections.lazy.test.tsx
decisions:
  - "The eslint-disable sits on the line before the tabIndex ATTRIBUTE, not before the opening tag: jsx-a11y reports no-noninteractive-tabindex on the attribute line, so a disable before `<div` was reported unused and the error stood."
metrics:
  duration: "~25 min"
  completed: 2026-10-16
  tasks: 2
  files: 2
---

# Phase 283 Plan 03: Bounded Chunks list (FIX-08) Summary

The Chunks list in the document detail panel now scrolls inside one 24rem (`max-h-96 overflow-y-auto`) region with role="region", tabIndex 0 and the label "Chunk list, N chunks" ("1 chunk" when there is one). A 1,000-chunk document no longer pushes Tables, Images, Found by and the other sections below it off the panel. There is no overscroll containment, the region is a single Tab stop, and the count still lives only in the section header.

## Base

- **Worktree landed on:** `a248672f0` (master merge, the v3.9-era default checkout). `merge-base` with the plan base was `60ce3797c` ≠ base → **reset** with `git reset --hard 9a0b7862205d386cc3baee8b820f7a960fc63d6e`.
- **PHASE_BASE:** `9a0b78622` (`docs(283): create phase plan`). Bootstrap: `BOOTSTRAP OK` (venv + node_modules junctioned, both .env copied).
- **Base file paths** (shared dir `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-283/`):
  - `tsc_base_9a0b78622_03.txt`: 103 lines (inherited `tsc -p tsconfig.app.json` errors)
  - `metadata_base_03.json`: `src/components/metadata` at base, 14 files, 106 passed, 0 failed
  - `metadata_after_03.json`: the same directory after this plan
  - `DocumentChunksSection_green_03.tsx`: the GREEN copy used to restore after each plant
- **Base lint:** `eslint -c eslint.a11y.config.js DocumentChunksSection.tsx` → **0 errors** (exit 0). Default `eslint DocumentChunksSection.tsx` → **1 inherited error**: `react-hooks/set-state-in-effect` at the `void load()` effect (64:10 at base, 70:10 now because the header comment grew; not introduced by this plan).
- **Base DetailSections.lazy.test.tsx:** 14 passed.

## Task 1: RED → GREEN (TDD)

**RED, `f68dab309`** `test(283-03): the chunk list is bounded, labelled and one Tab stop`. Six new `it` cases in the existing `describe("Chunks section — four honest arms and the per-chunk model")`. Result: **5 failed | 15 passed (20)**:

```
× D-16/D-17: bounds the chunk list inside ONE labelled, focusable region
  TestingLibraryElementError: Unable to find role="region" and name "Chunk list, 2 chunks"
× D-17: names a single chunk in the singular
  TestingLibraryElementError: Unable to find role="region" and name `/^chunk list/i`
× ⛔ D-17: no overscroll containment, so wheel at the list end chains to the panel
  TestingLibraryElementError: Unable to find role="region" and name "Chunk list, 2 chunks"
× ⛔ D-17: the region is ONE Tab stop, and the next Tab leaves it (no focus trap)
  TestingLibraryElementError: Unable to find role="region" and name "Chunk list, 2 chunks"
× D-18: the chunk count stays in the section header, never inside the list
  TestingLibraryElementError: Unable to find role="region" and name "Chunk list, 2 chunks"
```

The plan expected Tests 1, 2 and 4 to fail. Tests 3 and 5 also failed because they locate the region first. Test 6 (arms untouched) passes at HEAD, and the Task 2 plants are what show it can fail. All five fences were then driven RED one at a time against their own property (below).

**GREEN, `d88ae029c`** `fix(283-03): bound the Chunks list so every section below it stays reachable (FIX-08)`. The ready arm's `<ul className="flex flex-col gap-2">` is now wrapped, unchanged, in ONE `div`:
- `role="region"`, `aria-label={`Chunk list, ${rows.length} ${rows.length === 1 ? "chunk" : "chunks"}`}`, `tabIndex={0}`
- `className="max-h-96 overflow-y-auto rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"`
- `// eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG 2.1.1: …` directly above `tabIndex={0}`
- A dated Phase 283 paragraph in the file's header comment.

These are byte-unchanged: the loading, error and empty arms, `ChunkRowView`, the per-chunk `max-h-32` body, the fetch and `onTotalChange`. Suite: **20 passed (20)**.

Acceptance greps: `role="region"` = 1 · `max-h-96 overflow-y-auto` = 1 · `tabIndex={0}` = 1 · non-comment `overscroll` = 0 · `max-h-32` = 1 (base 1) · `eslint-disable` = 1 (names `jsx-a11y/no-noninteractive-tabindex` and `WCAG 2.1.1`) · `git diff 9a0b78622 -- DocumentDetailPanel.tsx` empty.

## Task 2: plants → failures (none committed)

For each plant: apply it to `DocumentChunksSection.tsx`, run the suite, then restore from the GREEN copy. Each plant failed **exactly one** test (1 failed | 19 passed):

| # | Planted change | Failing test | Message |
|---|---|---|---|
| 1 | `overscroll-contain` added to the region className | ⛔ D-17: no overscroll containment… | `expected [ 'overscroll-contain' ] to deeply equal []` |
| 2 | `tabIndex={0}` on the per-chunk `max-h-32` `<p>` | ⛔ D-17: the region is ONE Tab stop… | `expected <p tabindex="0" …(1)></p>` (querySelectorAll length > 0) |
| 3 | `<p>{rows.length} chunks</p>` inside the region | D-18: the chunk count stays in the section header… | `expected '2 chunks#0text-embedding-3-small · 15…' not to match /\bof\b \d+\|showing\|\d+ chunks?/i` |
| 4 | `max-h-96` removed from the region | D-16/D-17: bounds the chunk list inside ONE labelled, focusable region | `expected [ 'overflow-y-auto', …(4) ] to include 'max-h-96'` |
| 5 | empty arm wrapped in a `role="region" aria-label="Chunk list, 0 chunks"` | the empty and error arms are NOT wrapped in the chunk-list region | `expected <div role="region" …(1)>…(1)</div> to be null` |

After the restores, `git diff HEAD -- frontend/src/components/metadata/DocumentChunksSection.tsx` is empty and `git status --short` is clean.

## Gates

- **lint:a11y:** `npx eslint -c eslint.a11y.config.js src/components/metadata/DocumentChunksSection.tsx` → 0 errors, exit 0. The one justified disable is the only suppression.
- **Default eslint:** nothing new vs base. The only error is the inherited `react-hooks/set-state-in-effect`; there is no unused-directive warning.
- **tsc:** `npx tsc -p tsconfig.app.json --noEmit | sort | comm -13 tsc_base_9a0b78622_03.txt -` printed **nothing** (103 lines before, 103 after).
- **Neighbour suites** (`src/components/metadata`, 14 files): every file's count is at or above base, with 0 failures. Totals **106 → 112**. The only change is `DetailSections.lazy.test.tsx` going 14 → 20.
- **Wave disjointness:** `git diff 9a0b78622 --stat -- scripts/vitest-count-gate.cjs docs/HOT-FILE-LEDGER.md CLAUDE.md DocumentDetailPanel.tsx .planning/STATE.md .planning/ROADMAP.md` printed nothing.
- The full vitest count gate was **not** run here, by design: 283-01 owns the wave-1 run and 283-02 runs it on the merged tree.

## For 283-02's count-gate pin

**`DetailSections.lazy.test.tsx`: base 14 → 20** (measured, 20 passed, 0 failed). 283-02 Task 3 raises the `BASELINE` pin from 14 to 20 on the merged tree.

## D-19 note

No virtualisation, filter box or "Show first 20 / Show all" control was added. The orchestrator's G-4 drive (D-22 scenario 3, recorded in `283-LIVE-EVIDENCE.md`) still owes three things on a local document with ≤ 1,000 chunks: the expand time, the bounding-rect position of the next section header, wheel chaining and Tab-past.

## Deviations from Plan

**1. [Rule 3 - Blocking] The eslint-disable comment placement**
- **Found during:** Task 1 GREEN.
- **Issue:** The plan said to put the disable "on the line before the opening tag". jsx-a11y reports `no-noninteractive-tabindex` on the `tabIndex` **attribute** line, so a disable above `<div` came back `Unused eslint-disable directive` and the error stayed (lint:a11y exit 1).
- **Fix:** I moved the same comment, same wording, to the line directly above `tabIndex={0}` inside the opening tag. lint:a11y now exits 0 and the count of disables is still 1. This was settled before the GREEN commit, so Task 2 had no separate fix commit.
- **Files modified:** `frontend/src/components/metadata/DocumentChunksSection.tsx`
- **Commit:** `d88ae029c`

**2. [Note] RED had 5 failures, not 3.** Tests 3 and 5 locate the region before asserting their property, so they failed at base too. Plants 1 and 3 later showed each one fails on its own property against GREEN.

## Threat surface

T-283-07: the wrapper adds no HTML-injection prop, and the T-217-37 literal-text case stays green. T-283-09 (a11y lockout) is mitigated and fenced by Tests 3 and 4, both driven RED by plants 1 and 2. This plan opens no new trust boundary.

## Known Stubs

None.

## Not done here (orchestrator)

- `graphify update .` was not run inside the worktree, to avoid generated output on an agent branch. Run it after the merge.
- G-4 scenario 3 live drive and the closure of BUG-260908-01.

## Self-Check: PASSED

- FOUND: frontend/src/components/metadata/DocumentChunksSection.tsx (modified)
- FOUND: frontend/src/components/metadata/__tests__/DetailSections.lazy.test.tsx (modified)
- FOUND: f68dab309 (test RED) precedes d88ae029c (fix GREEN)
