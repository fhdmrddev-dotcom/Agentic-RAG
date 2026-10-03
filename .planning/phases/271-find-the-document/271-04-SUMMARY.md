---
phase: 271-find-the-document
plan: 04
subsystem: frontend (Library Documents tab: Find + Ask)
tags: [find, library, documents, filter-builder, ask, detail-panel, vitest-gate]
requires:
  - 271-01 (POST /document-search wire contract)
  - 271-02 (FindModeSwitch, FindMetaLine, AskHandoffCard, askInChat, onAskInChat prop)
  - 271-03 (findState, useDocumentFind, LinkTargetCombobox, RELATIONSHIP_FILTER_VERBS, DocumentList columns="find")
provides:
  - FilterBar Find-only props (quickAdd, suppressCount, saveDisabledReason, excludeFieldKeys) + exported FilterChip
  - ConditionPopover FIND_EXCLUDED_FIELD_KEYS + excludeFieldKeys
  - StructurePopovers (Version, Relationship, Folder, Added by, Date, Document type editors)
  - FindQuickAdd (the quick-add chip row, Version always visible)
  - DocumentsFindBody (FindSearchRow, DocumentsFindResults)
  - DocumentsPager exact
  - LibraryPage Find/Ask wiring on the Documents tab
  - DocumentDetailPanel read-only older-version mode
affects:
  - 271-05 (phase verification / live G-4 drive)
tech-stack:
  added: []
  patterns:
    - "one builder: Find-only optional props on the shipped FilterBar, Views tab passes none (DOM snapshot pin)"
    - "the page wires, a body component renders every state (documentSurface(lead, findSlots?))"
    - "a source-literal pin read by a backend test (FIND_EXCLUDED_FIELD_KEYS vs the resolver whitelist)"
key-files:
  created:
    - frontend/src/components/library/find/StructurePopovers.tsx
    - frontend/src/components/library/find/FindQuickAdd.tsx
    - frontend/src/components/library/find/DocumentsFindBody.tsx
    - frontend/src/components/ingestion/FilterBar.find271.test.tsx
    - frontend/src/components/ingestion/__snapshots__/FilterBar.find271.test.tsx.snap
    - frontend/src/components/library/find/__tests__/StructurePopovers.test.tsx
    - frontend/src/components/library/find/__tests__/FindQuickAdd.test.tsx
    - frontend/src/components/library/find/__tests__/DocumentsFindBody.test.tsx
    - frontend/src/components/library/__tests__/DocumentsPager.exact271.test.tsx
    - frontend/src/pages/__tests__/LibraryPage.find271.test.tsx
    - frontend/src/components/metadata/__tests__/DocumentDetailPanel.olderVersion271.test.tsx
    - backend/tests/unit/test_271_find_offered_fields.py
  modified:
    - frontend/src/components/ingestion/FilterBar.tsx
    - frontend/src/components/ingestion/ConditionPopover.tsx
    - frontend/src/components/ingestion/ConditionPopover.test.tsx
    - frontend/src/components/library/DocumentsPager.tsx
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/components/metadata/DocumentDetailPanel.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "P-02/P-06/P-10 applied as planned; documentSurface's second argument is named findSlots (not find) so it does not shadow the page's Find state"
  - "The Documents tab gets its own filter handler (handleFindFilterChange) instead of a tab branch inside handleFilterChange: the Views path is byte-unchanged and the Find path cannot reach resolveFilterIntoList"
  - "A set chip for a document type the filter holds is always offered in the editor, even when no loaded document carries it (otherwise it could not be unticked)"
  - "A second Document type or Date-in-the-document condition REPLACES the filter's existing one on that field rather than AND-ing a contradiction"
  - "The Find pager shows when total > min(limit, 25), so a smaller page size chosen earlier can still page a 20-row answer"
  - "A delete or refresh from a Find row re-asks the server (findResult.retry) so a removed row cannot linger"
metrics:
  duration: ~95 min
  completed: 2026-10-03
  tasks: 3
  commits: 7
  files: 19
---

# Phase 271 Plan 04: Find and Ask on the Library's Documents tab — Summary

The Documents tab now has a **Find documents | Ask** switch and a file-name input at the top, with Find's quick-add chips (Document type, Added by, Date, Folder, Relationship, and an always-visible Version chip) living on the one shipped FilterBar. Each chip sends exactly one server condition. Results come back in the server's order with an exact count and pager. Loading, zero, error and older-versions states are each honest, and an error keeps the previous rows instead of swapping in the unfiltered folder list. Ask hands the question to a new chat and renders no list. A row for an older version opens the detail panel, which says it is version history and offers no edits. The Views tab is byte-identical.

## Wave-1 gates, quoted BEFORE any source edit (Task 1 step 0)

Vitest count gate on the merged wave-1 tree (`ff4b98f01`), `GSD_VITEST_MAX_WORKERS=2`, verdict verbatim:

```
  total                                      8519    9282    +763
  total 9282  ·  failed 2  ·  pinned total 8519
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 2 test(s) failed — the gate requires 0.
```

Failing files, captured from the gate's own JSON (`vitest-count-gate-27900-1790985842479.json`) before any re-run: **`src/pages/__tests__/LibraryPage.test.tsx` only, 2 cases**. Case 1 (`renders heading 'Library'`) is `STACK_TRACE_ERROR`, the 5000 ms timeout on the suite's first-case dynamic `await import`. Case 2 is `Found multiple elements with the role "heading"`, the timed-out first render left mounted. Both match 271-02's inherited finding (reproduced there with base files). At this point the frontend diff against `ff4b98f01` was empty, so this red is inherited. The phase-base table in 271-BASELINES.md (73 failed) was not re-subtracted.

tsc (`npx tsc -p tsconfig.app.json --noEmit`) set diff against 271-BASELINES.md: **70 → 70**. The only differences are line shifts of base errors (`lib/api.ts` 263/264 → 267/268, `LibraryPage.tsx:50` → `:51`, both TS6133 `TabsList`/`TabsTrigger`). No new error code in any file.

## What was built

**Task 1 — the quick-add builder on the ONE FilterBar (D-04, D-06, D-07, P-06).**
- `FilterBar` exports `FilterChip`, which holds the shipped chip markup. The shipped metadata chips now render through it with an identical DOM.
- Four optional, Find-only props were added: `quickAdd` (rendered after the metadata chips, before ＋ condition), `suppressCount` (no span and no count request), `saveDisabledReason` (a muted line instead of Save as view) and `excludeFieldKeys` (passed to ConditionPopover).
- The Views-tab DOM was pinned before any edit by three `toMatchSnapshot` cases: empty filter, two conditions, and the ＋ condition popover open. All three still pass.
- `ConditionPopover` exports `FIND_EXCLUDED_FIELD_KEYS = ["name","type","size"]`. These are filtered out of the built-in and arrival-fact lists only. Watch scope and an org's custom fields are untouched.
- `backend/tests/unit/test_271_find_offered_fields.py` reads the three literals out of the TSX. It asserts that every offered key is in `_METADATA_BUILTINS ∪ _SOURCE_FACT_FIELDS` and that every excluded key is not, with a non-empty positive control.
- `StructurePopovers.tsx` has six editors in the shipped popover shell (`role="dialog"`, Esc cancels, 12px uppercase headings):
  - **Version:** three radios with verbatim helpers.
  - **Relationship:** eight radios derived from `RELATIONSHIP_FILTER_VERBS`, plus the shared `LinkTargetCombobox` over latest documents only, capped at 8. Apply stays disabled until both a verb and a document are picked.
  - **Folder:** indented by depth, with "Not in a folder" and **Include subfolders on by default**.
  - **Added by:** You, one option per connection name, and Anyone else. Never an email.
  - **Date:** "Which date" with the four 270 labels. "Date in the document" goes to the filter; the other three become Find dates.
  - **Document type:** `eq` for one pick, `one_of` for several.
- `FindQuickAdd` places the chips in fixed slots. A set single-value dimension replaces its ＋ button. The Version chip has a ✕ only away from Latest. One editor is open at a time, capped at `max-w-[calc(100vw-2rem)]`, and Esc returns focus to the chip that opened it.

**Task 2 — the Find results surface (D-01, D-02, D-03, D-06, S7).**
- `DocumentsFindBody.tsx` exports two components:
  - `FindSearchRow`: the mode switch plus an `h-9` input. The Find name and the Ask text are separate values. Esc in Find clears the name only. Enter in Find does nothing; Enter in Ask calls `onAsk` with non-blank text.
  - `DocumentsFindResults`: the meta line, then `DocumentList columns="find"` (with `folderId={undefined}` and the date column from `sortDateColumn`), or the zero box, the error alert and the older-versions hint. Loading keeps the rows (`aria-busy`, `opacity-60`). An error keeps the rows under a `role="alert"`. Zero is claimed only once an answer has arrived.
- `.sort(` / `.slice(` occur 0 times in the file.
- `DocumentsPager` gains `exact`, which skips the 1000-row cap arm. Browse is unchanged.

**Task 3 — page wiring and older versions (D-01, D-02, D-03, D-06).**
- `LibraryPage` adds `useReducer(findReducer, initialFindState)` beside the shipped reducer. `useDocumentFind` is handed `null` unless the Documents tab is in Find mode with an active search.
- `documentSurface(lead, findSlots?)` takes one optional argument:
  - `top` is the search row plus, in Find mode, the shared bar with `FindQuickAdd`, `suppressCount`, `FIND_EXCLUDED_FIELD_KEYS` and the "can't be saved" reason.
  - `body` is the Ask card in Ask mode, `DocumentsFindResults` while a search is active, and otherwise null, which falls back to the shipped lead, list and pager.
  - `documentSurface(viewsLead)` is unchanged.
- The Documents tab's filter handler never calls `resolveFilterIntoList` (T-271-14).
- Other wiring:
  - A folder pre-seed fires on the edge where a search starts.
  - `handleSelectFolder` also dispatches `CLEAR_SEARCH`.
  - Clear search resets the Find state and `EMPTY_FILTER`.
  - `selectedDoc` resolves from `documents`, then from the Find rows.
  - `onAskInChat` is wired to the card and to Enter.
  - The panel-open summary chip counts metadata plus structure conditions.
- `SHED_COLUMNS_3_TO_5`, the guarded subtitle and the `${tab}-pagehead` wrapper are byte-unchanged. `renameFence` is green.
- `DocumentDetailPanel`: with `is_latest === false`, a `role="status"` line reads "This is an older version (v1). It is version history: fields can only be changed on the latest version." Field values render as text (missing values read "not recorded"), and `handleCommit` returns early. When `is_latest` is true or undefined the panel is unchanged, and a test pins that.

## TDD gate compliance

Every task has a `test(271-04)` commit before its `feat(271-04)` commit:

| Task | RED | RED result | GREEN |
|---|---|---|---|
| 0 | `c1ceb5c66` | snapshot pins written from the pre-edit tree (3 cases); ConditionPopover adopted at 10 | — |
| 1 | `f8ef69ba6` | 8 failed / 16 passed. StructurePopovers and FindQuickAdd failed at import (module missing). The passing cases are the snapshots, the self-count control and the shipped ConditionPopover cases. Backend: 4 failed (`FIND_EXCLUDED_FIELD_KEYS array literal not found`) | `7a4fecc74` |
| 2 | `72135fe13` | DocumentsFindBody failed at import. DocumentsPager.exact271 failed 1 of 3; the 2 browse-invariant cases passed | `451ad4feb` |
| 3 | `d38bc2116` | 13 failed / 3 passed. The 3 are invariant pins: the Views tab and the latest/undefined panel unchanged | `608e39c56` |

## Verification

**Targeted suites, all green:**
- Task 1: FilterBar, FilterBar.find271, ConditionPopover, `library/find/__tests__`, RuleBuilderPanel — 104/104. The backend offered-fields test passes 4/4, and the backend 271 unit files pass 84/84.
- Task 2: DocumentsFindBody 26/26, DocumentsPager.exact271 3/3, and `src/components/library/__tests__` apart from the inherited `sketchComposition` timeout (see below).
- Task 3:
  - `src/pages/__tests__` plus `renameFence`: 318 passed / 2 failed, both the inherited `LibraryPage.test.tsx` pair.
  - `src/components/metadata`, `src/components/ingestion`, ViewCardGrid, IndexingTab.gate, IngestionTab.reconnectControl and ChatLayout.badge: 323/323.

**Wave-2 vitest count gate**, `GSD_VITEST_MAX_WORKERS=2`, verdict verbatim:

```
  total                                      8659    9414    +755
  total 9414  ·  failed 4  ·  pinned total 8659
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 4 test(s) failed — the gate requires 0.
```

Failing files, from the gate's JSON (`vitest-count-gate-48576-1790987979291.json`) before any re-run:
- `src/pages/__tests__/LibraryPage.test.tsx`, 2 cases: the same pair as the wave-1 run and the same signatures.
- `src/components/library/__tests__/sketchComposition.test.tsx`, 2 cases: case 1 `STACK_TRACE_ERROR` (5 s timeout on the first-case dynamic import of LibraryPage), case 2 `Found multiple elements with the role "tab"` (the leaked first render).

How sketchComposition was triaged:
- During Task 2, before LibraryPage was touched, the same two cases failed three times running alone, including once with the **base** `DocumentsPager.tsx` checked out by explicit path and then restored. LibraryPage.tsx was byte-identical to the base at that point, so the red reproduces without this plan's page or pager edits.
- It was green in the wave-1 gate run. That is consistent with a load-dependent first-case timeout: about 46 node processes were on the box.
- It is not provably unaffected by Task 3's larger import graph, because I did not re-run it with base LibraryPage.tsx after Task 3. I am recording this as an observation, not as "fine".

The gate's growth is all accounted for:
- **Pinned total, +140:** 132 newly adopted cases (ConditionPopover 13, FilterBar.find271 11, StructurePopovers 22, FindQuickAdd 12, DocumentsFindBody 26, DocumentsPager.exact271 3, LibraryPage.find271 13, DocumentDetailPanel.olderVersion271 3, askInChat 5, FindModeSwitch 7, FindMetaLine 10, AskHandoffCard 5, LibraryPage.filingRules271 2) plus 8 from re-pins (LibraryHeaderBar 9→13, ClassificationRulesPage 8→11, RuleBuilderPanel 8→9).
- **Grand total, +132:** these 13 files had never run under the gate.
- **No pinned file decreased.**

**tsc after Task 3:** 70 → 70. The only difference is the pre-existing `LibraryPage.tsx` TS6133 pair moving from line 51 to 58. No new error in any phase-touched file.

**Acceptance greps:**
- `FIND_EXCLUDED_FIELD_KEYS` in ConditionPopover: 2.
- In StructurePopovers: `<LinkTargetCombobox` 1, `role="combobox"` 0.
- Forbidden vocabulary ("relevance", "smart", "AI search", "query") in StructurePopovers and FindQuickAdd: 0 / 0.
- `useDocumentFind(` 1, `onAskInChat` 4, `documentSurface(viewsLead)` 1, `searchDocuments` 0 in LibraryPage.
- `SHED_COLUMNS_3_TO_5 =` in the diff: 0.
- Every 271-02 and 271-04 suite appears twice in `vitest-count-gate.cjs`, with exactly one BASELINE key each.
- `check-hot-file-ledger.cjs`: `ledger gate OK`.

## Deviations from Plan

### Superseded by wave-1 records (applied as instructed)
- **`searchDocuments` appears in `lib/api.ts`.** This was put there by 271-03 for the gated `apiBarrel.test.ts`. The plan's "0 in `lib/api.ts`" check is superseded. LibraryPage imports nothing from Find's client, and the hook imports from `@/lib/api/documents`.
- **The zero state ("No documents match")** is owned by `DocumentsFindResults`, because `DocumentList columns="find"` renders nothing on zero rows.

### Auto-fixed issues
1. **[Rule 1] The Document type editor could not untick a held type.** A type the filter held but no loaded document carried was not offered, so the condition could not be removed from its own editor. Held types are now always offered. Found by the FindQuickAdd "replaces" case during Task 1 GREEN. Commit `7a4fecc74`.
2. **[Rule 1] A second Document type or Date-in-the-document condition now replaces the existing one on that field.** Before, it was appended, which ANDs two contradictory conditions into a guaranteed zero. Commit `7a4fecc74`.
3. **[Rule 1] Pager visibility uses `total > min(limit, 25)`.** With only `total > 25`, a page size of 10 chosen on an earlier search would strand a 20-row answer on page 1 with no pager. Commit `451ad4feb`.
4. **[Rule 2] Delete and refresh from a Find row re-ask the server** (`findResult.retry`). Otherwise a deleted document stays in the Find answer. Commit `608e39c56`.
5. **[Rule 1] The panel's read-only mode imports `NOT_RECORDED`**, so a missing value reads "not recorded" instead of an empty line (the 270 rule).

### Own-test corrections after RED (recorded rather than smoothed over)
- `StructurePopovers.test.tsx`: the single-date input's label changed from "Date" to "On date". It collided with the dialog's own `aria-label="Date"`. Folded into the GREEN commit.
- `LibraryPage.find271.test.tsx`:
  - The lead marker changed from the label "Choose files" to "Documents not assigned to a folder". The page mounts the default `DocumentUpload` variant, and only the hero variant carries that label.
  - The row click now targets the filename cell's button, because the row's Download control also names the file.
  - The real RED failures were unaffected; no case was weakened to pass.
- `DocumentDetailPanel.olderVersion271.test.tsx`: the edit-control matcher was narrowed from `^(Edit|Add) ` to `Edit/Add <metadata field>`. Another section exposes an `Add …` button, which made the broad matcher count a control that is not an inline editor.

### Naming choice
- `documentSurface`'s second argument is called `findSlots` rather than `find`, so it does not shadow the page's Find state. Behaviour is as specified.
- The Documents tab uses its own `handleFindFilterChange` rather than a tab branch inside `handleFilterChange`. Same effect, and the Views path stays byte-unchanged.

## Owed / not done here
- **G-4 live drive (Chrome)** of scenarios 1, 2, 4, 5 and 6 is owed at phase verification (271-05). That includes the UI-SPEC contrast check: warning text on its 10% wash must measure ≥ 4.5:1, which jsdom cannot measure.
- **`sketchComposition.test.tsx` and `LibraryPage.test.tsx`** each time out on their first case, a dynamic import under load. The inheritance evidence is above; a static-import fix like 271-02's would remove the flake, but that is out of this plan's scope.
- **Hot-file ledger rows** for LibraryPage.tsx, DocumentDetailPanel.tsx, FilterBar.tsx, ConditionPopover.tsx, DocumentsPager.tsx and `vitest-count-gate.cjs` were not edited, because the plan forbids touching `docs/HOT-FILE-LEDGER.md` and `CLAUDE.md`. Their triples moved and are owed a re-derivation at the phase close.
- **Under-pins left as found:** `LibraryPage.initialTab.test.tsx` (pinned 6, actual 15) and `LibraryPage.test.tsx` (pinned 12, actual 17). Neither grew because of this plan.
- **`graphify update .`** was not run in the worktree. The orchestrator should run it after merge.
- **P-01** (`DEFAULT_SORT = added_desc`) is still flagged for operator review.

## Known Stubs

None. Every chip, state and handler is wired to real data. The Relationship and Added-by candidates come from the documents the page already holds. A target document that is not loaded on the page cannot be picked, which is the shipped Phase 117 behaviour.

## Threat Flags

None. There are no new endpoints or auth paths. T-271-14 is mitigated: Find never calls `resolveFilterIntoList`, and a LibraryPage case asserts the folder list does not reappear on a 422. T-271-15 is mitigated by `FIND_EXCLUDED_FIELD_KEYS` and its backend pin. T-271-16 is mitigated by the read-only panel and the early return in `handleCommit`. T-271-17 is mitigated: a mount case asserts zero requests at rest, and a case asserts three keystrokes produce one call.

## Self-Check: PASSED

- All 7 created source/test files and the snapshot exist on disk.
- All 7 commits (c1ceb5c66, f8ef69ba6, 7a4fecc74, 72135fe13, 451ad4feb, d38bc2116, 608e39c56) are in `git log ff4b98f01..HEAD`.
- No file deletions in the plan range.
