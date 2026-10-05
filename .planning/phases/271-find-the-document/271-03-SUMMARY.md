---
phase: 271-find-the-document
plan: 03
subsystem: frontend (Library Find contracts)
tags: [find, library, documents, relationships, vitest-gate]
requires:
  - 271-01 wire contract (POST /document-search) — typed here from its <interfaces> text
provides:
  - frontend/src/pages/findState.ts (findReducer, initialFindState, isSearchActive, canSaveAsView, toSearchRequest, SORT_OPTIONS, DEFAULT_SORT, sortDateColumn)
  - frontend/src/hooks/useDocumentFind.ts (debounced, stale-guarded, error-keeps-rows)
  - searchDocuments + DocumentSearchError in frontend/src/lib/api/documents.ts
  - DocumentSearchRequest / DocumentSearchRow / DocumentSearchResponse / RelVerb in types/index.ts
  - RELATIONSHIP_FILTER_VERBS + deriveFilterVerbs in relationshipLabels.ts
  - LinkTargetCombobox (extracted Phase 117 typeahead)
  - lib/documentAddedBy.ts (addedBy + NOT_RECORDED)
  - DocumentList/DocumentRow columns="find" + findDateColumn
affects:
  - 271-04 (composes all of the above into the Documents tab)
tech-stack:
  added: []
  patterns: [strict zero-import reducer leaf, FilterBar timerRef+reqIdRef debounce, ?raw backend pin with positive control, extract-not-fork]
key-files:
  created:
    - frontend/src/pages/findState.ts
    - frontend/src/pages/__tests__/findState.test.ts
    - frontend/src/hooks/useDocumentFind.ts
    - frontend/src/hooks/__tests__/useDocumentFind.test.tsx
    - frontend/src/lib/api/__tests__/documents.search271.test.ts
    - frontend/src/components/relationships/LinkTargetCombobox.tsx
    - frontend/src/components/relationships/LinkTargetCombobox.test.tsx
    - frontend/src/components/relationships/relationshipLabels.test.ts
    - frontend/src/lib/documentAddedBy.ts
    - frontend/src/lib/__tests__/documentAddedBy.test.ts
    - frontend/src/components/ingestion/__tests__/DocumentRow.find271.test.tsx
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api/documents.ts
    - frontend/src/lib/api.ts
    - frontend/src/components/relationships/relationshipLabels.ts
    - frontend/src/components/relationships/CreateLinkDialog.tsx
    - frontend/src/components/metadata/DocumentFileFacts.tsx
    - frontend/src/components/ingestion/DocumentList.tsx
    - frontend/src/components/ingestion/DocumentRow.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "P-01 applied: DEFAULT_SORT = added_desc, docblock flags it for operator review and names the two places to override"
  - "searchDocuments/DocumentSearchError ARE re-exported from the lib/api.ts barrel, against the plan, because the gated apiBarrel.test.ts requires every runtime export of api/documents.ts there; consumers still import from @/lib/api/documents"
  - "Filter-verb transform stated as: a chip label whose first word ends in 'ed' becomes 'Is ' + lower-cased label; finite verbs unchanged"
  - "DocumentList in find mode ignores folderId (structural, not by convention) and renders nothing on zero rows (the Find body owns the S7 zero state)"
  - "LinkTargetCombobox resets its active option when the exclusion set's CONTENTS change, not its identity"
metrics:
  duration: ~40 min
  completed: 2026-10-03
  tasks: 3
  commits: 8
  files: 20
---

# Phase 271 Plan 03: Find client contracts, verb table, combobox and the Find column set Summary

The frontend half of Find that does not touch the page: a zero-import Find state leaf that produces the exact `POST /document-search` body (or `null` at rest), a request hook that makes zero calls at rest, debounces 300 ms, drops stale answers and keeps the previous rows on error, the 8 relationship verbs derived from the shipped Phase 117 maps and pinned to the backend `_INVERSE_LABEL`, the Phase 117 combobox extracted (not forked) into `LinkTargetCombobox`, one home for "Added by", and a `columns="find"` set on the shared document list that keeps exactly seven cells.

## What was built

**Task 1 (FIND-01/03, D-03, D-06, P-01).** `findState.ts` copies `librarySelection.ts`'s shape: the WHY / STRICT LEAF / CANNOT PRODUCE docblock (it names the result page, `total`, `older_matches` and the request id as excluded), a structural `FindFilterLike`, readonly state, a 12-member action union and a total reducer. Every condition action resets `offset` to 0; `SET_MODE`/`SET_ASK_TEXT` touch only their own field (S5); `CLEAR_SEARCH` resets the conditions and the version to `latest` and keeps mode, sort and Ask text. `toSearchRequest` returns `null` when not active, otherwise the exact wire body (trimmed name or null, snake_case keys). `canSaveAsView` is false for a name, folder, added by, file date, relationship or non-latest version (Pitfall 9). `useDocumentFind` follows FilterBar's `timerRef` + `reqIdRef` pattern, keyed on the serialised body, and its catch keeps rows and total (S7; it is explicitly not `resolveFilterIntoList`).

**Task 2 (D-04, D-07).** The three relationship suites were measured at the phase base (8 / 11 / 6) and adopted into both gate knobs before any extraction. `RELATIONSHIP_FILTER_VERBS = deriveFilterVerbs(OUTGOING_LABEL, INCOMING_LABEL)`; the four "Is …" labels appear nowhere in the source as literals (grep 0). Its keys are pinned against the Python source via `?raw` with a 4-pair positive control. The combobox's state, keyboard walk, `choose`, and input + listbox JSX moved out of `CreateLinkDialog.tsx`, keeping WR-04 (`aria-controls` only while visible). The dialog mounts it with `maxVisible={Infinity}`, so its shipped uncapped list is preserved. `CreateLinkDialog.test.tsx` is byte-unchanged and green.

**Task 3 (D-07, P-05, P-09).** `addedBy` was moved verbatim into `lib/documentAddedBy.ts` with `NOT_RECORDED`, and `DocumentFileFacts` imports both. In `columns="find"`, cells 3-5 are Document type / Added by / Date (the header is named by `sortDateColumn`; missing values read italic "not recorded"; a date-only `metadata.date` is built in local time so it cannot shift a day). The folder pill is replaced by a `text-xs text-muted-foreground` second line: `/A/B` via the shipped `folderPathOf`, or "Not in a folder", plus the version tag ("v2 · 2 versions" neutral, "v1 · older version" warning). Browse renders a byte-identical `<table>` (asserted by `outerHTML` equality). The `hasVersions` body is unchanged; only a one-line P-05 comment was added above it.

## TDD gate compliance

Each task has a RED `test(271-03)` commit before its GREEN `feat(271-03)` commit.

- **Task 1 RED** (`dc871c406`): `findState.test.ts` and `useDocumentFind.test.tsx` failed at import (module missing). `documents.search271.test.ts` failed 3/3 with `TypeError: searchDocuments is not a function`.
- **Task 2 RED** (`75fe475d6`): `LinkTargetCombobox.test.tsx` gave `Failed to resolve import "./LinkTargetCombobox"`. `relationshipLabels.test.ts` failed 4 of 5: `expected undefined to deeply equal [ { key: 'supersedes', …(3) }, …(7) ]` and `deriveFilterVerbs is not a function`. The one passing case pins the untouched Phase 117 maps.
- **Task 3 RED** (`307d7d59b`): `documentAddedBy.test.ts` failed at import. `DocumentRow.find271.test.tsx` failed 11 of 17. The 6 that passed at RED are deliberate invariant pins that must hold both before and after: browse byte-identical, browse headers, seven `<td>` per row, the single-version no-tag case, and the two P-05 chevron cases.
- **GREEN:** `adac33ead` (93/93 including librarySelection and apiBarrel), `7bc8e785b` (relationships 39/39), `313cc8651`.

## Verification

- Targeted suites, all green: `findState` 49, `documents.search271` 3, `useDocumentFind` 11, `librarySelection` (unchanged), `apiBarrel` 5, relationships dir 39 (5 files), `documentAddedBy` 6, `DocumentRow.find271` 17. `DocumentList.test.tsx`, `DocumentRow.download270.test.tsx` and `DocumentList.moveToFolder.test.tsx` are 27/27 when run in isolation.
- tsc `-p tsconfig.app.json` set diff: base 70 → HEAD 70, **zero new errors** (line-agnostic diff). Two base errors in `lib/api.ts` moved by +4 lines because of the barrel lines.
- Acceptance greps: `^import` in findState = 0; `DEFAULT_SORT` = 1; `from "@/lib/api/documents"` in the hook = 1; `filteredDocs` in the hook = 0; `role="combobox"` is 0 in the dialog and 1 in the combobox; the "Is …" literals = 0; `function addedBy` is 0 in DocumentFileFacts and 1 in documentAddedBy. `LibraryPage.tsx` and `CreateLinkDialog.test.tsx` have no diff against the base, and no hunk touches `version_number ?? 1) > 1`. Every suite this plan created, plus the three newly guarded relationship suites, appears at least twice in `vitest-count-gate.cjs`.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/271-find-the-document` → `ledger gate OK`.

### Timeouts observed under machine load (inherited, not caused by this plan)

Running the whole `src/components/ingestion` + `src/components/metadata` directories together produced 9 to 11 `Test timed out in 5000ms` failures, and the **set changed on every run**. Files affected included AutomationGroup, ViewsGroup, ConditionPopover, IngestionPauseBanner, DetailSections.lazy/tables, DocumentDetailPanel.a11y/file270, DocumentList and download270. Measured at the time: about 53 `node.exe` processes on the box, from sibling wave agents. To tell inherited from new, I checked out the three base source files by explicit path, re-ran the same directories, and got the same timeout class (21 failures, including the expected find271 RED cases). I then restored HEAD, and `git status` was clean. Run in smaller batches or serially, the row and list suites pass. Each serial re-run showed a *different* single DetailSections case timing out, which is the flake signature and not a defect. I did not run the full count gate: under this load it cannot give a clean verdict. It is owed once per wave (G-8).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 — contradiction with a gated guard] `searchDocuments` and `DocumentSearchError` ARE re-exported from the `lib/api.ts` barrel**
- **Found during:** Task 1.
- **Issue:** The plan says "never add to the barrel", and its acceptance criterion is `grep -c searchDocuments lib/api.ts → 0` (271-04 repeats this). The gated `src/lib/__tests__/apiBarrel.test.ts` (BASELINE 5) requires *every* runtime export of `api/documents.ts` to be in the barrel (D-207-06), so following the plan would have turned a pinned suite red. The plan's stated reason is also inaccurate: a mock factory for `@/lib/api` only throws when a consumer *imports the symbol through the barrel*. A re-export in the real barrel affects no mock.
- **Fix:** Two barrel lines, with a comment that they exist only for `apiBarrel.test.ts`. Every consumer imports from `@/lib/api/documents`, as the plan's key_link requires: `useDocumentFind` does.
- **Impact on 271-04:** its acceptance grep `searchDocuments in lib/api.ts → 0` cannot hold while `apiBarrel.test.ts` stands. Read it as superseded by this record. The intent (no consumer imports through the barrel) is met.
- **Commit:** `adac33ead`.

**2. [Rule 2] `DocumentList` in find mode ignores `folderId` structurally and renders nothing on zero rows**
- The plan relied on 271-04 passing `folderId={undefined}`. A folder id passed by mistake would silently hide cross-folder results, so find mode now never re-filters (pinned by a test). Browse's zero-state copy ("No root documents yet.") would mislabel an empty search, so find mode returns `null` there and 271-04's Find body owns the S7 zero state.
- **Commit:** `313cc8651`.

**3. [Rule 1] Date-only values formatted in local time**
- `new Date("2019-03-04")` is UTC midnight and displays as 3 Mar west of UTC. The Find Date cell builds date-only values as local calendar dates. The test's expectation helper was corrected the same way before GREEN, in the same commit.
- **Commit:** `313cc8651`.

**4. [Design detail] LinkTargetCombobox props beyond the plan's list**
- Added `onChoose(null)` (typing invalidates a pick, which the dialog previously handled internally), `listboxLabel`, `initialQuery` (for 271-04 editing a set chip) and `inputId`. The dialog passes `maxVisible={Infinity}` to keep its shipped uncapped list.
- The active-option reset now fires when the exclusion set's **contents** change, not its identity. This prevents an owner that rebuilds an equal Set on each render from resetting the arrow-key walk. Recorded divergence: a dialog rel-type switch between two types with the *same* exclusion set no longer resets the active option. The option is still in range and still valid.

**5. [Process] Task 3's gate adoption is a separate commit** (`e4acf10f3`), not folded into the feature commit as the plan's step 5 said. The content is the same.

## Owed / not done here

- **Full vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`): owed at the wave close, on a quieter box. The new pins are measured passing counts; the totals will grow by 100 pinned + 25 newly guarded cases.
- **`graphify update .`** was not run in this worktree. It writes tracked `graphify-out/` files and would conflict with sibling merges; the orchestrator should run it once after merge.
- **Hot-file ledger rows:** not edited, per the plan (⛔ `docs/HOT-FILE-LEDGER.md`). The gate reads OK. `DocumentRow.tsx`, `DocumentList.tsx`, `types/index.ts`, `lib/api/documents.ts` and `lib/api.ts` triples moved and are owed a re-derivation at the phase close.
- **P-01** stays flagged for operator review (`DEFAULT_SORT`).

## Known Stubs

None. Every export is wired to real data or is a pure function. The page composition is 271-04's.

## Threat Flags

None. The only new surface is the client call to 271-01's endpoint, which is already in the plan's threat model (T-271-11/12/13 mitigated and tested: no "@" in Added by, zero requests at rest plus a 300 ms debounce plus a stale drop, and the verb table pinned to `_INVERSE_LABEL`).

## Self-Check: PASSED

- All 11 created files and 9 modified files exist at HEAD (verified with `git diff --stat` against the base: 20 files).
- Commits `dc871c406`, `adac33ead`, `864cb2261`, `75fe475d6`, `7bc8e785b`, `307d7d59b`, `313cc8651`, `e4acf10f3` are present in `git log`.
