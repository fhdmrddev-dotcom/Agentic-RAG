---
phase: 284-library-at-scale
plan: 03
subsystem: frontend / library
tags: [library, paging, loading-state, realtime, pager, ingestion, detail-panel, tdd, frontend, seed-248]
requires:
  - phase: 284-01
    provides: "useLibraryDocuments seam, listDocumentsPage / getLibrarySummary / getDocument and the per-document page clients"
  - phase: 284-02
    provides: "GET /documents envelope, GET /library/summary, GET /documents/{id}, paged per-document routes"
provides:
  - "useLibraryDocuments server body: one page + one summary + one read by id; source = browse | view | filter"
  - "Realtime as a hint: INSERT / DELETE / terminal UPDATE → ONE refetch per 500 ms window; on-page UPDATE merges"
  - "Library states: cold skeleton, cold / warm failure, warm aria-busy, silent background refetch, S8 open-by-id"
  - "Exact pager everywhere; the ROW_CAP arm deleted from frontend/src"
  - "IngestionTab on the summary + three paged GET /documents?status= lists"
  - "Chunks paged by scroll sentinel; Tables / Images / Versions say N of M"
  - "frontend/src/test-utils/fakeLibraryApi.ts — a fixture-backed fake that answers like the server"
affects: [284-04, 284-05]
tech-stack:
  added: []
  patterns:
    - "List state DERIVED in render from one settled-request record (no setState in an effect)"
    - "IntersectionObserver with root = the bounded region, re-made after each page, guarded for jsdom"
    - "A file-local fake server (installFakeLibraryApi) instead of mocking whole arrays"
key-files:
  created:
    - frontend/src/test-utils/fakeLibraryApi.ts
    - frontend/src/pages/__tests__/LibraryPage.states284.test.tsx
    - frontend/src/components/metadata/__tests__/DocumentChunksSection.paging284.test.tsx
    - frontend/src/components/ingestion/__tests__/DocumentRow.versions284.test.tsx
  modified:
    - frontend/src/hooks/useLibraryDocuments.ts
    - frontend/src/hooks/useDocuments.ts
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/components/library/DocumentsPager.tsx
    - frontend/src/components/library/LibraryHeaderBar.tsx
    - frontend/src/components/library/IngestionTab.tsx
    - frontend/src/components/ingestion/FolderTree.tsx
    - frontend/src/components/ingestion/FolderNode.tsx
    - frontend/src/components/metadata/DocumentChunksSection.tsx
    - frontend/src/components/metadata/DocumentTablesSection.tsx
    - frontend/src/components/metadata/DocumentImagesSection.tsx
    - frontend/src/components/ingestion/DocumentRow.tsx
key-decisions:
  - "archivedHidden counts archived rows in scope whether shown or hidden (plan said 0 when shown) — the shipped 'Showing N archived · Hide' arm needs it"
  - "Include-archived is a WARM change (rows stay), not cold; a source switch is cold"
  - "New copy uses the typographic apostrophe (’), per the UI-SPEC voice rule and 284-01"
  - "A view / filter resolve's archived count is |total(opposite flag) − total| from ONE count_only read"
  - "IngestionTab lists mount with their sub-tab, so the Library at rest makes no list request"
metrics:
  duration: "~2h05m"
  completed: 2026-10-16
  tasks: 3
  commits: 6
---

# Phase 284 Plan 03: The Library pages on the server Summary

The Library now asks the server for one page and its numbers instead of holding every document. `useLibraryDocuments` reads `GET /documents` (one page), `GET /library/summary` (every count) and `GET /documents/{id}` (a selected document that is on neither the page nor Find's rows). Realtime only triggers a debounced refetch. Loading, failed and empty are three different states. The pager is exact everywhere and the 1,000-row cap arm is deleted. IngestionTab reads the summary and three paged lists. The detail panel's Chunks section pages as you scroll, and Tables, Images and Versions say "N of M".

**PLAN_BASE:** `0ae58d8bd423419d3eccbb21173cc185a658627e` (wave 1 merged). The worktree started at `60ce3797c` (the master tip). The merge-base check failed, so it was reset to PLAN_BASE before any edit.

**Base files** are in `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-284/`:
- `tsc_base_0ae58d8_03.txt` and `.norm.txt`: 66 `error TS` lines at base. The prompt's figure of 58 was stale.
- `vitest_base_0ae58d8_03.json` and `.counts.txt`: the 8-directory set. 158 files, 2886 passed, **0 failed**, 1 skipped. `sourceComposition` was green at base, 49/49.
- `red_03_t1.json/.txt`, `red_03_t2.json/.txt`, `red_03_t3.json/.txt`: the RED captures.
- `vitest_final_03.json` and `.counts.txt`: the wave-end run.

## Tasks

| # | Task | RED | GREEN |
|---|------|-----|-------|
| 1 | Hook body, Realtime hint, fake, nine suites rewired | `44b83c8c2` | `59a4b1259` |
| 2 | Loading / failed / exact states, pager, header, tree, IngestionTab | `964eba73d` | `765b30bf7` |
| 3 | Chunks sentinel paging; Tables / Images / Versions N of M | `061446251` | `bbd666006` |

## RED evidence

**Task 1** (against the wave-1 body): 156 failed / 328 passed.
- In every suite fed through the fake, the wave-1 hook iterates `useDocuments().documents`, which is now absent, and throws `TypeError: docs is not iterable`.
- `useDocuments.test.ts` failed 5 of 7, for example `expected "vi.fn()" to not be called at all, but actually been called 1 times` (the hook still fetched a list).

**Task 2:** 71 failed / 41 passed.
- `IngestionTab` ×3 threw `TypeError: documents is not iterable`.
- `states284` failed on the missing `role="status"` and the missing alerts.
- The pager read `1–25 of 1500+` where `1–25 of 1,500` was expected.
- `LibraryHeaderBar` failed the `Counting…` / `Count not known yet` cases.
- Five `states284` cases passed at RED because Task 1 already shipped their behaviour: empty after success, silent refetch, `Reading N files`, S8 read-once, and 404.

**Task 3:** 36 failed / 200 passed.
- The chunks, tables and images sections found no rows, because they called the array clients, which the suites no longer serve.
- `paging284` could not find a region named `Chunk list, 2,500 chunks, 200 loaded`.
- `versions284` could not find the version history table.

## Per-file pass counts (base → after)

| Suite | Base | After |
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
| useLibraryDocuments.test.ts | 13 | **24** |
| IngestionTab.test.tsx | 42 | **50** |
| IngestionTab.readerOff.test.tsx | 5 | 5 |
| IngestionTab.reconnectControl.test.tsx | 6 | 6 |
| DocumentsPager.exact271.test.tsx | 3 | 3 |
| LibraryHeaderBar.test.tsx | 13 | **16** |
| DetailSections.lazy.test.tsx | 20 | 20 |
| DetailSections.tables.test.tsx | 15 | **18** |
| DocumentDetailPanel.images.test.tsx | 3 | **4** |
| StructurePopovers.test.tsx (import only) | 27 | 27 |
| DocumentRow.download270.test.tsx (mock adapter only) | 6 | 6 |
| LibraryPage.states284.test.tsx | n/a | **15** (new) |
| DocumentChunksSection.paging284.test.tsx | n/a | **8** (new) |
| DocumentRow.versions284.test.tsx | n/a | **3** (new) |

**Wave-end targeted run** (`src/pages src/components/{library,ingestion,metadata,retention,sources} src/__tests__/hooks src/lib`): 161 files, **2938 passed / 0 failed / 1 skipped**, against 2886 / 0 / 1 at base. Every file present at base is ≥ its base count. The failing set is empty both times.

### For 284-05's count-gate pins

| File | Count |
|---|---|
| `LibraryPage.states284.test.tsx` | 15 (new) |
| `DocumentChunksSection.paging284.test.tsx` | 8 (new) |
| `DocumentRow.versions284.test.tsx` | 3 (new) |
| `useLibraryDocuments.test.ts` | 13 → 24 |
| `IngestionTab.test.tsx` | 42 → 50 |
| `LibraryHeaderBar.test.tsx` | 13 → 16 |
| `DetailSections.tables.test.tsx` | 15 → 18 |
| `DocumentDetailPanel.images.test.tsx` | 3 → 4 |

## Cases rewritten in place, and why

These cases were rewritten rather than deleted. Each one keeps its count.
- **`useDocuments.test.ts`** (still 7):
  - "fetches documents on mount" → "never fetches a list of its own", per D-24.
  - "adds document to list after upload" → "upload returns the created document and asks for a refetch", per D-08: the caller decides whether the row belongs on its page.
  - The INSERT-prepend case → "INSERT / DELETE call onChange (no list patch)" (T-284-16 / T-284-17).
  - The UPDATE spread-merge case: assertions unchanged; only its setup now hands the hook the caller's rows.
- **`DocumentsPager.exact271` case 2** → "browse at total 1,500 renders the exact total, grouped — no '+', no cap line" (D-09).
- **`LibraryPage.test` "list may be larger"** → "the pager reads the exact server total at the old 1000-row ceiling" (D-09).
- **`useLibraryDocuments` "inFlight keeps … paused"** → "inFlight is the summary's pending + processing". R-04: paused is not a stored status.
- **`IngestionTab` 429 banner case:** the fixture `status: "paused" as any` became `status: "processing"` with the same 429 message. Per R-04 that is the real shape of a rate-limited file.
- **`find271` CR-01:** `toHaveBeenCalledTimes(1)` became "ONE page read (non-count_only) + ONE count read, called with `{offset: 0, limit: 25, include_archived: false}`". The assertion is more precise than before, not weaker.
- **`libraryRetention` saved-view case:** the resolve is served by the fake, which evaluates `include_archived`. `toHaveBeenCalledWith("view-inv")` now carries the page args.
- **`findBy` waits** were added only where rows or summary numbers now arrive asynchronously (find271 ×3, libraryRetention ×4, LibraryPage.test ×3). No assertion content changed.

## tsc / eslint

- **tsc** (`tsc -p tsconfig.app.json`, `(line,col)`-normalised set diff vs PLAN_BASE): **no new errors**. 66 at base, 63 now. Three inherited test-file errors are gone as a side effect: the `useDocuments.test` Promise type, `IngestionTab.test`'s unused `renderTechnical`, and `sketchComposition`'s missing `upload` / `uploading`.
- **eslint** (rule-id multiset per touched source, base through `git show | eslint --stdin` vs the tree, JSON formatter): identical or lower for all 12 sources. `DocumentChunksSection` went 1 → 0.
  - The first GREEN of Task 2 added 2 `react-hooks/set-state-in-effect` errors in the hook. The list state is now **derived in render** from one settled-request record, and the remembered selection uses React's guarded "adjust state while rendering" pattern. Both are back to 0.
- **a11y eslint** (`eslint.a11y.config.js`) on the four Task 3 sources: clean. On the Task 2 sources: only IngestionTab's inherited `jsx-a11y/no-redundant-roles` (the `ul role="list"`, moved unchanged).
- **No backend, supabase, `lib/api`, `types`, scripts, docs or CLAUDE.md change.** `git diff PLAN_BASE --stat` on those paths is empty.

## Acceptance greps (measured)

All met except the two collisions listed below:
- `listDocumentsPage(` 1, `getLibrarySummary(` 1, `getDocument(` 1 in the hook.
- `listDocuments` in `useDocuments.ts` code: 0. `summarizeDocuments` in the hook: 0.
- `fakeLibraryApi` is never imported by product code.
- `ROW_CAP` / "The list may be larger than shown" outside tests: none.
- The three LibraryPage copy lines: 1 each. `Counting…` in the header: 1. `count={rootDocumentCount ?? 0}`: 0.
- `documents: Document[]` in IngestionTab: 0. `status: "done"` 1, `order: "updated_desc"` 1. `documentsForIngestion`: 0.
- `IntersectionObserver` 4, `disconnect()` 1, `overscroll-` 0.
- "showing the first" 1 + 1. "versions, showing" 1. `IntersectionObserver` in `setupTests.ts`: none.

Two greps collide with other contracts. Both are recorded here, and neither was gamed:
- **The `{ ...d, ...newDoc }` merge appears twice in `useDocuments.ts`:** once in code and once in the Phase 217 comment, which the plan says to keep verbatim. It was also 2 at base. The code-only count is 1.
- **The "show all|load more" grep on DocumentChunksSection returns 1:** the UI-SPEC's binding failure copy "Couldn’t load more chunks". There is no such button; `paging284` asserts that at every point. Rendering the copy split up just to pass the grep would be dishonest.
- `onTotalChange?.(res.length)` across `metadata/*.tsx` totals 1, in `DocumentQueriesSection.tsx` ("Found by"). That section is not a per-document paged list and is not in this plan's files. It is out of scope and logged here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree base.** The worktree was reset from master's tip to PLAN_BASE before any edit.

**2. [Rule 1 - Bug] `archivedHidden` when archived rows are SHOWN.** The plan said "0 otherwise". That would delete the shipped "Showing N archived document(s) · Hide" arm, which `libraryRetention` asserts.
- Browse now uses `summary.root.archived` / `summary.folders[id].archived` whatever the toggle.
- A view or filter uses `|total(opposite flag) − total|` from the ONE extra `count_only` read.

**3. [Rule 3 - Blocking] Two suites outside the file list.**
- `StructurePopovers.test.tsx`: an import line only. `summarizeDocuments` moved to the fake.
- `DocumentRow.download270.test.tsx`: one mock adapter, because DocumentRow now calls `fetchDocumentVersionsPage`.
- ⚠ **Merge note for the orchestrator:** 284-04 may edit `StructurePopovers.test.tsx`. The 284-03 change is line 18 only.

**4. [Rule 3 - Blocking] `sketchComposition` / `sourceComposition` render IngestionTab directly.** Both renders now take `summary` / `summaryState` in place, with the same assertions.

**5. [Rule 1 - Bug] Selection fetch before the page answered.** On mount, a selected id fetched `GET /documents/{id}` even when the page would contain the document. The read now waits until the list has settled (`ready` or `error`).

**6. [Rule 1 - Bug] Paging away from an open document would close the panel.** The panel remounted while the id read ran. The last list-resolved row is now remembered, so a page change keeps the panel open. A deleted document clears the memory.

**7. [Rule 2 - Missing critical, T-284-21] Empty next chunk page.** If a page comes back empty while the total says there is more, the total is set to what is loaded, so the sentinel cannot loop.

**8. [Plan wording] `documentsForIngestion` window.** It returned the current page rows from `59a4b1259` to `765b30bf7` (Task 1 → Task 2), then it was deleted.

**9. [Hygiene] `FilterBar.find271.test.tsx.snap` line endings.** Every vitest run rewrote them. The file was restored each time with a single-file `git checkout --` and never committed.

**10. [Tooling] Commit-msg hook.** The hook caps a body at 12 lines. Task 2's first GREEN message was refused and recommitted shorter, with the same content scope.

### Not done / noted

- `Skill("sketch-findings-agentic-rag")` is not available to this agent (there is no Skill tool here). No layout changed. The new states copy the shipped treatments the UI-SPEC cites: DocumentsFindBody's alert and dim, and DocumentChunksSection's bars.
- `docs/HOT-FILE-LEDGER.md`'s DocumentChunksSection bullet, "Above 1,000 chunks the header count is the PostgREST cap … Phase 284", is now false. This plan may not edit the ledger. **284-05 should correct it** (the strike-through-and-correct style). The file's own docblock was corrected here.
- Find's pager now groups totals of 1,000 or more (`1,500`, not `1500`), following the UI-SPEC typography rule. Below 1,000 its output is byte-identical, which `DocumentsPager.exact271` case 3 asserts.
- `graphify update .` was not run in the worktree; it would write a shared artifact. Run it on the merged tree.
- The view / filter page relies on 284-04's server-side `offset` / `limit` / `include_archived`. Until that merges, a resolve returns the whole match set (no client slice, by plan).

## TDD Gate Compliance

Each task has its `test(284-03)` commit before its `feat(284-03)` commit: `44b83c8c2` → `59a4b1259`, `964eba73d` → `765b30bf7`, `061446251` → `bbd666006`. RED was observed failing every time.

## Threat surface

Nothing beyond the register. T-284-16 / T-284-17 (Realtime never patches; only on-page ids merge), T-284-18 (`null` until answered), T-284-19 (one user-JWT read by id; a 404 shows no copy), T-284-20 (500 ms coalescing, silent) and T-284-21 (one page at a time, a docId change discards answers, the empty-page guard) are all mitigated in code and pinned by the suites above.

## Known Stubs

None. Every number and row is wired to a server read.

## Self-Check: PASSED

- FOUND: `frontend/src/test-utils/fakeLibraryApi.ts`
- FOUND: `frontend/src/pages/__tests__/LibraryPage.states284.test.tsx`
- FOUND: `frontend/src/components/metadata/__tests__/DocumentChunksSection.paging284.test.tsx`
- FOUND: `frontend/src/components/ingestion/__tests__/DocumentRow.versions284.test.tsx`
- FOUND commits: `44b83c8c2`, `59a4b1259`, `964eba73d`, `765b30bf7`, `061446251`, `bbd666006`
- STATE.md / ROADMAP.md untouched (orchestrator-owned).
