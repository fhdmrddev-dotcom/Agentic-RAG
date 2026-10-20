---
phase: 284-library-at-scale
plan: 01
subsystem: frontend / library
tags: [library, paging, wire-contract, data-hook, g-5-extraction, tdd, frontend, seed-248]
requires: []
provides:
  - "frontend wire contract for paged GET /documents, GET /documents/{id}, GET /library/summary, per-document page clients, paged view resolve"
  - "useLibraryDocuments — the D-24 data seam LibraryPage reads through"
  - "number-prop LibraryStatTiles / FolderDetail and list-prop Find Added-by / Document-type editors"
affects: [284-03, 284-04, 284-05]
tech-stack:
  added: []
  patterns:
    - "legacy-shape tolerance: Array.isArray(body) ? legacy : envelope, for one release"
    - "null means not answered — children render … / Not known yet, never 0"
key-files:
  created:
    - frontend/src/hooks/useLibraryDocuments.ts
    - frontend/src/lib/api/__tests__/libraryPaging284.test.ts
    - frontend/src/__tests__/hooks/useLibraryDocuments.test.ts
    - frontend/src/components/ingestion/__tests__/FolderDetail284.test.tsx
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api/documents.ts
    - frontend/src/lib/api/library.ts
    - frontend/src/lib/api/knowledge.ts
    - frontend/src/lib/api.ts
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/pages/__tests__/LibraryPage.cloudImport.test.tsx
    - frontend/src/components/library/LibraryStatTiles.tsx
    - frontend/src/components/library/__tests__/LibraryStatTiles.test.tsx
    - frontend/src/components/ingestion/FolderDetail.tsx
    - frontend/src/components/library/find/StructurePopovers.tsx
    - frontend/src/components/library/find/FindQuickAdd.tsx
    - frontend/src/components/library/find/__tests__/StructurePopovers.test.tsx
    - frontend/src/components/library/find/__tests__/FindQuickAdd.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "The hook result is named libDocs on the page, because lib is already the selection reducer's state"
  - "R-11 pin settles at 0, not at some N: after Task 3 the page reads no document field at all; the expression gained ?? 0 because a regex with no match returns null"
  - "Summary-fed Find editors keep You / Anyone else (and any type the filter already holds) in the loading and error arms; only the summary-derived options are withheld"
  - "UI-SPEC voice rule wins over nearby Find copy: the new failure line uses a typographic apostrophe (Couldn’t load this list.)"
metrics:
  duration: "~37 min"
  completed: 2026-10-16
  tasks: 3
  commits: 6
---

# Phase 284 Plan 01: Library wire contract and the D-24 data seam Summary

This plan adds the paged Library wire contract on the client side: `listDocumentsPage` (offset and limit required by type), `getDocument`, `getLibrarySummary`, four per-document page clients and paged `resolveView` / `resolveAdHoc`. Each one accepts the old array response for one release. It also moves LibraryPage's whole-library derivations into one hook, `useLibraryDocuments`, and gives the children that only count numbers instead of the documents array. The screen is unchanged and every existing LibraryPage suite passes untouched except the R-11 re-pin.

**PLAN_BASE:** `f8659ac2d56f8cf3b93174e1ee834f383eb192c6`. The worktree started at `a248672f0` (master tip). The merge-base check failed, so it was reset to PLAN_BASE before any edit.

**Base files** (in `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-284/`):
- `tsc_base_f8659ac_01.txt` (103 lines). `tsc_base_f8659ac_01.norm.txt` is the same output with `(line,col)` stripped. The set diff is taken on the normalised form, because line shifts in `lib/api.ts` would otherwise show two inherited `IndexSummary` / `FolderIndexRow` errors as new.
- `vitest_base_f8659ac_01.json`: the plan's 7-directory set at base. 198 files, 3313 tests, **3312 passed / 0 failed / 1 skipped**. `sourceComposition.test.tsx` was **green** at base in this sample (49/49). The plan expected it red; the standing red is flaky, so this run says nothing about it either way.
- `vitest_t2_01.json` (after Task 2), `vitest_final_01.json` (after Task 3).
- `red_01_t1.txt`, `red_01_t3.txt`: the RED captures.

## Tasks

| # | Task | RED commit | GREEN commit |
|---|------|-----------|--------------|
| 1 | The paged wire contract | `294ed57b1` test(284-01): the paged wire contract | `8347ac705` feat(284-01): … envelopes, single read, summary, per-document pages |
| 2 | The D-24 seam, useLibraryDocuments | `63c00f95d` test(284-01): the Library data hook | `f0f6428b2` refactor(284-01): LibraryPage reads its documents through useLibraryDocuments |
| 3 | Children that count take numbers | `dec9a4c34` test(284-01): children that count take numbers | `a928b8ccd` refactor(284-01): stat tiles, folder band and Find editors take numbers |

## RED evidence

**Task 1:** `libraryPaging284.test.ts` gave **19 failed / 3 passed (22)**. Representative lines:
```
× serialises every given key, in a fixed order, and returns the envelope unchanged
TypeError: listDocumentsPage is not a function
× GETs /library/summary uncached
× resolveView sends offset, limit and include_archived when given
× the chunk, table, image and version clients unwrap an envelope body
  - Expected: [ { chunk_index: 0, ... } ]   + Received: { chunks: [...], limit: 200, offset: 0, total: 1 }
```
The 3 cases that passed at RED pin current behaviour that must not change: `resolveView` with only `count_only`, `resolveAdHoc` with only `count_only`, and a legacy array body returned unchanged. They were not testing anything new.

**Task 2:** `useLibraryDocuments.test.ts` failed to collect:
```
Error: Failed to resolve import "@/hooks/useLibraryDocuments" from "src/__tests__/hooks/useLibraryDocuments.test.ts". Does the file exist?
```

**Task 3:** the four suites gave **33 failed / 41 passed (74)**. Every converted case and every new arm failed against the old props. Two examples: `× CHUNKS loading renders … in both slots, never 0` and `× renders with no documents prop at all (it is optional now)` (TypeError iterating an undefined `documents`).

## R-11 re-pin

`LibraryPage.cloudImport.test.tsx`: `pageSource.match(/\.folder_id\b/g)?.length` went **7 → 1 (Task 2) → 0 (Task 3)**.
- Task 2 pinned 1. The single remaining read was FolderDetail's array input, which was temporary until Task 3.
- Task 3 pinned `?.length ?? 0` to `0`. `?? 0` is needed because a regex with no match returns `null`.
- The dated comment `284-01 (R-11)` gives the reason: the reads moved into `useLibraryDocuments` with the derivations (D-24).
- The assertion this pin protects, `not.toMatch(/\bfolder_id\s*:/)`, is **unedited**.
- `git diff PLAN_BASE -- frontend/src/pages/__tests__` touches only this file: +6/−1, the re-pin line and its comment.

## Per-file pass counts vs base (vitest_final_01.json vs base)

Every file present at base has the same pass and fail counts, except the three suites this plan converted on purpose, which went up. **0 failed.**

| Suite | Base | Now |
|---|---|---|
| LibraryPage.test.tsx | 17 | 17 |
| LibraryPage.cloudImport.test.tsx | 8 | 8 |
| LibraryPage.filingRules271.test.tsx | 2 | 2 |
| LibraryPage.find271.test.tsx | 18 | 18 |
| LibraryPage.initialTab.test.tsx | 15 | 15 |
| LibraryPage.tabAttention.test.tsx | 15 | 15 |
| sketchComposition.test.tsx | 46 (+1 skip) | 46 (+1 skip) |
| libraryRetention.test.tsx | 16 | 16 |
| sourceComposition.test.tsx | 49 | 49 |
| useDocuments.test.ts | 7 | 7 |
| apiBarrel.test.ts | 5 | 5 |
| `__tests__/lib/api.test.ts` | 42 | 42 |
| LibraryStatTiles.test.tsx | 13 | **16** (13 converted in place + 3 arms) |
| StructurePopovers.test.tsx | 22 | **27** (+5 arms) |
| FindQuickAdd.test.tsx | 22 | **26** (+4) |
| libraryPaging284.test.ts | n/a | **22** (new) |
| useLibraryDocuments.test.ts | n/a | **13** (new) |
| FolderDetail284.test.tsx | n/a | **5** (new) |

Totals: 3312 passed at base, 3364 passed now (+52 = 22+13+5+3+5+4).

Count-gate pins added or raised in both knobs: `libraryPaging284.test.ts: 22`, `useLibraryDocuments.test.ts: 13`, `FolderDetail284.test.tsx: 5`, `LibraryStatTiles 13→16`, `StructurePopovers 22→27`, `FindQuickAdd 22→26`. The full count gate was **not** run here; per the plan it runs once per wave on the merged tree.

## tsc / eslint set diffs

- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`, `(line,col)`-normalised set diff vs base): **empty** after every task. 103 errors at base and 103 now, all inherited.
- **eslint** (rule-id multiset per touched file: base through `git show … | eslint --stdin` vs the working tree, JSON formatter): **identical** for all 10 modified source files. The 12 inherited messages are LibraryPage 5, FindQuickAdd 3, StructurePopovers 3, types 1. The new `useLibraryDocuments.ts` has 0. The first attempt used `--format unix`, which isn't installed. It printed nothing for both sides, so "same" would have been a false pass; it was redone with `--format json`.
- No backend, supabase or database change (`git diff PLAN_BASE -- backend supabase` is empty).

## The hook's return shape, as built

```ts
useLibraryDocuments({ folderId, filteredDocs, includeArchived, offset, limit, selectedDocId, findRows })
→ {
  rows: Document[]                 // one page of the folder, or the whole resolved view (unsliced)
  total: number | null             // shown rows the pager counts over
  archivedHidden: number | null    // splitArchived's archivedCount (ArchivedHiddenLine's count)
  inFlight: number | null          // pending | processing | paused, today's predicate
  summary: LibrarySummary | null   // summarizeDocuments(documents) in wave 1
  summaryState, listState: "loading" | "ready" | "error"   // always "ready" in wave 1
  loading: boolean; error: Error | null                     // false / null in wave 1
  selectedDoc: Document | null     // documents → findRows → null
  refresh, upload, deleteDoc, uploading, uploadingCount     // useDocuments pass-throughs
  documentsForIngestion: Document[]                         // WAVE 1 ONLY: the raw array
}
```
`summarizeDocuments(docs)` is exported and pure. It uses the server's field names: `paused` is always 0; `steps` counts only processing documents; `rate_limited_in_flight` uses IngestionTab's predicate; `connections` are in first-seen order; `document_types` are sorted with `localeCompare`.

**`IngestionTab` still receives `documentsForIngestion` until 284-03**, and so does `FindQuickAdd`'s `documents` pass-through, which only RelationshipEditor reads, until 284-04 frees it. The page still has these page-level fallbacks: `inFlight ?? 0` (0 means no live pill), `archivedHidden ?? 0` (0 means no hidden line), the pager not rendered while `total` is null, and `…` for an unknown Root count. None of them can fire in wave 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree base was master's tip, not PLAN_BASE.** The worktree was reset to `f8659ac2d` before any edit, as the spawn instructions require.

**2. [Rule 3 - Blocking] Hook placement forced the pager state up.** The hook needs `offset` / `limit`, and `selectedDoc` (now the hook's) is read before the old pager block. So the `pageOffset` / `pageSize` `useState` and their reset effect moved up, unchanged, to just before the hook call. They are still page UI state, as the plan requires.

**3. [Rule 1 - Honesty] The R-11 pin needed `?? 0`.** At 0 occurrences, `match()` returns `null` and `?.length` is `undefined`, so `toBe(0)` could never pass. Same line, same commit discipline.

**4. [Rule 1 - Hygiene] Vitest rewrote line endings in `FilterBar.find271.test.tsx.snap`.** The change was LF↔CRLF only. Both times it was restored with a single-file `git checkout --` and not committed.

**5. [Rule 2 - Copy contract] The new editor failure line uses `’`** (`Couldn’t load this list.`), per UI-SPEC's voice rule. Neighbouring Find strings use a straight `'`.

**6. Acceptance-grep fix.** FolderDetail's docblock spelled "Count not known yet", so the grep counted 2 instead of 1. The docblock now names the copy by reference ("UI-SPEC S5's failure copy").

### Not done / noted
- The `Skill("sketch-findings-agentic-rag")` load named in read_first was not available to this agent: there is no Skill tool here. Tasks 2 and 3 are byte-identical in their ready arm, and the new arms follow UI-SPEC S5, S6 and S12 verbatim.
- `graphify update .` was not run inside the parallel worktree, to avoid writing a shared artifact. The orchestrator should run it after the merge.

## TDD Gate Compliance

Each task has a `test(284-01)` commit before its `feat` / `refactor` commit: 294ed57b1 → 8347ac705, 63c00f95d → f0f6428b2, dec9a4c34 → a928b8ccd. RED was seen failing every time.

## Known Stubs

These are intentional for wave 1 and documented in the hook's docblock. 284-03 replaces the body.
- `frontend/src/hooks/useLibraryDocuments.ts`: `summaryState: "ready"`, `listState: "ready"`, `loading: false`, `error: null` are constants, because the array is already in memory. 284-03 swaps in `listDocumentsPage` + `getLibrarySummary` + `getDocument`.
- `documentsForIngestion`: the raw array, kept for IngestionTab (284-03) and RelationshipEditor (284-04). It is named so that deleting it makes the compiler name every remaining reader.

## Threat surface

There is no new network surface beyond the plan's threat model. T-284-01: only typed params reach the URL. T-284-02: the legacy branch is labelled and slated for 284-05. T-284-03: summary numbers are typed `number | null`, and children render `…` / "Not known yet".

## Self-Check: PASSED
- FOUND: frontend/src/hooks/useLibraryDocuments.ts
- FOUND: frontend/src/lib/api/__tests__/libraryPaging284.test.ts
- FOUND: frontend/src/__tests__/hooks/useLibraryDocuments.test.ts
- FOUND: frontend/src/components/ingestion/__tests__/FolderDetail284.test.tsx
- FOUND commits: 294ed57b1, 8347ac705, 63c00f95d, f0f6428b2, dec9a4c34, a928b8ccd
