---
phase: 279-the-expert-scope-seam
plan: 03
subsystem: experts-chat-frontend
tags: [seed-328, copy, g4, frontend, tdd]
requirements: [SEAM-01]
dependency_graph:
  requires: ["279-01"]
  provides:
    - "LEDGER_COPY.wontSearch / wontSearchAll; EVENT_COPY.wontBeSearched"
    - "previewLedgerColumns(preview, { onThread })"
    - "StreamsProvider WORKFLOW_LOCK_DETAIL_PREFIX-narrowed send 409 arm (D-15, prerequisite for the D-13 drive)"
    - "ExpertSpotlightCard folderId / threadId props"
  affects: ["279-04 G-4 drives", "D-13 two-org drive"]
tech_stack:
  added: []
  patterns: ["corrections beside originals (279-marked)", "?raw cross-pin of a backend literal"]
key_files:
  created: []
  modified:
    - frontend/src/components/experts/catalog/expertCatalog.ts
    - frontend/src/components/experts/catalog/ExpertDetailModal.tsx
    - frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
    - frontend/src/components/experts/ScopeLedger.tsx
    - frontend/src/components/chat/InviteExpertDialog.tsx
    - frontend/src/components/chat/expertEventCopy.ts
    - frontend/src/components/chat/ExpertSpotlightCard.tsx
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/lib/api/experts.ts
    - backend/app/services/expert_scope_statement.py
    - backend/tests/unit/test_267_scope_preview.py
decisions:
  - "D-09/D-16: the restricted wall is named by what it denies (SEARCH); attachments stay readable"
  - "D-15: only a 409 whose detail starts 'Thread is workflow-locked' keeps the fixed lock copy"
  - "WR-03(1): the no-folder-thread column is driven by a client fact (onThread); compose_expert_scope unchanged"
metrics:
  completed: 2026-10-13
  tasks: 2
  commits: 6
---

# Phase 279 Plan 03: SEED-328 copy + client half Summary

"Won't use" now reads "Won't search" everywhere; the swap card's sub-line reads "Won't be
searched:"; a restricted Expert states what it will not search on a no-folder thread and on the
spotlight. The invite dialog shows the server's org refusal, and a send 409 that is not the
workflow lock shows the server's reason and keeps the draft. The chip never shows the previous
thread's Expert, handoff is hidden while streaming, and catalog Start Chat names the real cause.

## Worktree base

- Landed on `8764137fe` (master merge, NOT the expected base). `git merge-base HEAD 10596004b` was
  `e8964257e` ≠ `10596004b`, so ran `git reset --hard 10596004b`; HEAD = `10596004bb5e61eeaf1b2b8bbcd8a7b68e2074aa`.
- `bash scripts/bootstrap-worktree.sh` → BOOTSTRAP OK (venv + node_modules junctioned, both .env copied).

## Base frontend typecheck error set (`npx tsc -p tsconfig.app.json --noEmit`, at 10596004b)

66 errors, 30 files, exit 2. `file code xCount` (line/col stripped). **None in any file this plan modifies.**

```
src/__tests__/hooks/useDocuments.test.ts TS2322 x1
src/__tests__/hooks/useFolders.test.ts TS6133 x1
src/__tests__/hooks/useMessages.test.ts TS2353 x1
src/__tests__/hooks/useMessages.test.ts TS2554 x4
src/__tests__/providers/streamsProvider_state01b_403.test.tsx TS6133 x1
src/components/chat/__tests__/ChatAreaMode.test.tsx TS2322 x4
src/components/chat/__tests__/MessageInput.connectors.test.tsx TS6133 x1
src/components/chat/MessageSkeleton.tsx TS2503 x1
src/components/experts/ExpertAuthoringStudio.tsx TS6133 x3
src/components/layout/__tests__/ChatLayoutLaunch.test.tsx TS2740 x1
src/components/layout/NavPanel.test.tsx TS2352 x1
src/components/library/__tests__/IngestionTab.test.tsx TS2345 x1
src/components/library/__tests__/IngestionTab.test.tsx TS2741 x2
src/components/library/__tests__/IngestionTab.test.tsx TS6133 x4
src/components/library/__tests__/sketchComposition.test.tsx TS2739 x1
src/components/library/__tests__/ViewCardGrid.test.tsx TS2345 x1
src/components/library/__tests__/ViewCardGrid.test.tsx TS2554 x2
src/components/library/indexing/FoldersIndexTable.tsx TS6133 x1
src/components/org/OrgExpertsTab.tsx TS6133 x3
src/components/panel/__tests__/FilesSection.test.tsx TS2304 x3
src/components/panel/FilePreview.test.tsx TS2783 x3
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx TS2322 x4
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx TS6133 x1
src/components/settings/__tests__/ConnectionFormPanel.sourceTools.test.tsx TS6133 x1
src/components/settings/ConnectionFormPanel.tsx TS2322 x1
src/components/settings/ConnectionFormPanel.tsx TS2339 x3
src/components/settings/ConnectionFormPanel.tsx TS2353 x1
src/components/settings/MemorySection.tsx TS2339 x1
src/components/skills/SkillFormDialog.tsx TS2322 x2
src/components/workflows/WorkflowDoorSwitch.tsx TS2322 x1
src/lib/api.test.ts TS2322 x1
src/lib/api.ts TS2305 x1
src/lib/api.ts TS2724 x1
src/pages/LibraryPage.tsx TS6133 x2
src/pages/SettingsPage.test.tsx TS2322 x1
src/pages/SettingsPage.tsx TS2322 x1
src/pages/SettingsPage.tsx TS2561 x1
src/providers/OrgProvider.test.tsx TS2741 x1
src/providers/OrgProvider.test.tsx TS6133 x1
src/stores/streamsStore.ts TS2345 x1
```

## Commit log

| Letter | Item | Commit SHA | RED test (file + case) + RED line | GREEN result |
|---|---|---|---|---|
| A | WR-04 / D-09 / D-16 "Won't search" + "Won't be searched:" | `9ac6d12f6` | 9 files run against base source: `Tests 11 failed \| 186 passed (197)` — InviteExpertDialog (9)(10)(13)(15)(W6), ExpertEventCard (3b), ExpertSpotlightCard unscopedChat, expertCatalog narrowing + new `279-03 LEDGER_COPY`, expertEventCopy (7)(11) | `Tests 197 passed (197)`; backend `test_279_pure_move.py` + `test_267_scope_preview.py` → `28 passed` |
| B | WR-03(1) no-folder thread column + IN-01 / D-20 org refusal | `f75945c6b` | `Tests 3 failed \| 80 passed (83)` — expertCatalog `restricted + no thread folder + onThread`, InviteExpertDialog (11) corrected, (11c) IN-01 sentence; (11b)/(11d)/unchanged/narrowing passed RED (they pin UNCHANGED behaviour) | Task 1 verify suite `Tests 203 passed (203)` |
| C | D-15 send 409 arm keyed on `Thread is workflow-locked` | `8581da302` | streamsProvider.test.tsx `Tests 2 failed \| 43 passed (45)` — Test 3b `expected 'This thread is running a workflow — c…' to be 'Switch to this chat's organization t…'`; Test 3c `expected '…' to contain 'WORKFLOW_LOCK_DETAIL_PREFIX = "Thread…'` | streamsProvider + ChatAreaBanner `Tests 54 passed (54)`; out-of-scope 409 pins StreamsProvider.stopping + state01b_403 `36 passed` |
| D | WR-06 chip clear + note, WR-01 handoff hidden while streaming | `c708c7920` | ChatArea.expertThread.test.tsx `Tests 2 failed \| 24 passed (26)` — (20) WR-06 failed-load clear, (22) WR-01 handoff absent while streaming; (21) Pitfall 4 passed RED (pins the no-blank behaviour the fix must keep) | expertThread + ChatAreaBanner + scopeChange `50 passed`; approval/capPaused/model/Mode `19 passed` |
| E | WR-03(2) spotlight restricted preview for the picked folder | `4ba2692e5` | `Tests 3 failed \| 39 passed (42)` — ExpertSpotlightCard `folderId 'f-1' fetches…`, `changing folderId re-fetches…`; ChatArea.expertThread (11b) empty thread with folder | spotlight + expertThread + Banner + scopeChange + Mode `71 passed` |
| F | WR-07 Start Chat real cause + `listExperts(true, false)` ×3 | `10d7e2d5e` | ExpertCatalogPage.test.tsx `Tests 3 failed \| 19 passed (22)` — (8) `expected [] to deeply equal [ true, false ]`, (8b) `Target cannot be null or undefined.`, WR-07 ApiError reason | Task 2 verify suite (7 files) `Tests 153 passed (153)` |

## D-09 / D-16 — the measured "Won't use" set, and every changed expectation (fixture-text record)

The pre-edit grep (`Won't use\|will not be used\|wontUse` over `frontend/src backend/app backend/tests`)
measured **29 hits in 13 files**, not the 30 / 13 RESEARCH Q8 quoted; the measured set governed. After:
the only hits are 279-marked lines (the grep piped through `grep -v 279` returns nothing).

Source / comments reworded in place (no original kept, per the plan): expertCatalog.ts `wontUse` →
`wontSearch` (`Won't search · ${n}`), `wontUseAll` → `wontSearchAll` (`Won't search`), comments at the
old :440 / :472; ExpertDetailModal.tsx:284 "will not be used" → "will not be searched";
InviteExpertDialog.tsx:11; ScopeLedger.tsx:7; lib/api/experts.ts:245;
expert_scope_statement.py:25 (docstring); test_267_scope_preview.py:387 (comment). Test titles and
comments reworded in place: InviteExpertDialog.test.tsx :6 :235 :258 :415 :449; ChatArea.expertThread
:496; ExpertSpotlightCard.test :256; expertCatalog.test :677.

Changed EXPECTATION / fixture lines — each keeps its original directly above as
`// 279-03 WR-04 (D-09/D-16): was …` (base line numbers):

| File:line | Old | New |
|---|---|---|
| InviteExpertDialog.test.tsx:241 | `getByText("Won't use · 4")` | `getByText("Won't search · 4")` |
| InviteExpertDialog.test.tsx:254 | `findByText("Won't use · 7")` | `findByText("Won't search · 7")` |
| InviteExpertDialog.test.tsx:263 | `queryByText(/Won't use/)` null | `queryByText(/Won't search/)` null (then rewritten again in Commit B — see case (11)) |
| InviteExpertDialog.test.tsx:295 | `findByText("Won't use · 4")` | `findByText("Won't search · 4")` |
| InviteExpertDialog.test.tsx:310 | `findByText("Won't use · 4")` | `findByText("Won't search · 4")` |
| InviteExpertDialog.test.tsx:423 | `toContain("Won't use")` | `toContain("Won't search")` |
| ExpertSpotlightCard.test.tsx:268 | `toContain("Won't use")` | `toContain("Won't search")` |
| expertThemeContrast.test.tsx:99 | fixture heading `"Won't use · 4"` | `"Won't search · 4"` |
| expertCatalog.test.ts:686 | `toBe("Won't use")` | `toBe("Won't search")` |
| ScopeLedger.test.tsx:68 | fixture heading `"Won't use"` | `"Won't search"` |
| expertEventCopy.test.ts:122 (7) | `"ACME_MSA_2026.pdf · … · Chat attachments stay readable."` | `"Won't be searched: ACME_MSA_2026.pdf · … · Chat attachments stay readable."` |
| expertEventCopy.test.ts:160 (11) | `"a.pdf · … · and 4 more · Chat attachments stay readable."` | `"Won't be searched: a.pdf · … · and 4 more · Chat attachments stay readable."` |

Added: ExpertEventCard.test.tsx (3b) asserts the sub-line starts with `"Won't be searched: "`
(ExpertEventCard (3)'s `/Chat attachments stay readable\.$/` regex is unchanged and still green);
expertCatalog.test.ts `279-03 WR-04 — LEDGER_COPY says Won't search` (no retired key remains).

## Case (11) correction (D-20)

InviteExpertDialog.test.tsx (11) kept its title. It asserted NO "Won't" column on threadId `t-1` with
`thread_folder: null` — that pinned the WR-03 defect. Its old assertions are kept as
`// 279-03 WR-03: was …` comments and it now expects a `scope-ledger-col-no` column reading
"Won't search" + "All your documents" at rest, no "· 0" box, and the invite control present (the
statement never blocks the invite). Added (11b) brand-new chat (`threadId: null`) keeps "Will use"
alone; (11c) IN-01 `ApiError("Switch to this chat's organization to preview an Expert.", 409)` shows
that sentence; (11d) a `TypeError` keeps the generic "Couldn't check which documents …" copy.

## Per-file test cases (base → after, `it(` count delta from `git diff 10596004b HEAD`)

| File | Added | Title-reworded (−1/+1) | Net |
|---|---|---|---|
| chat/__tests__/InviteExpertDialog.test.tsx | 3 | 3 | +3 |
| experts/catalog/__tests__/expertCatalog.test.ts | 4 | 1 | +4 |
| chat/__tests__/ExpertEventCard.test.tsx | 1 | 0 | +1 |
| __tests__/providers/streamsProvider.test.tsx | 2 | 0 | +2 |
| chat/__tests__/ChatArea.expertThread.test.tsx | 4 (20)(21)(22)(11b) | 1 | +4 (23 → 27 cases) |
| chat/__tests__/ExpertSpotlightCard.test.tsx | 3 | 1 | +3 |
| experts/catalog/__tests__/ExpertCatalogPage.test.tsx | 3 | 0 | +3 |
| chat/__tests__/expertEventCopy.test.ts, expertThemeContrast.test.tsx, experts/__tests__/ScopeLedger.test.tsx | 0 | 0 | 0 (expectation edits only) |

No test was deleted; no per-file count decreased.

## Typecheck set diff (D-14)

`npx tsc -p tsconfig.app.json --noEmit` after Commit F: 66 errors, and the normalised set
(line/col stripped, sorted) is **identical** to the base set above — `comm -13 base after` (new) is
empty and `comm -23` (gone) is empty. After ⊆ base holds.

## D-14 — FIRING files changed by guarded expressions only (honoured by construction)

- `StreamsProvider.tsx`: one module constant + one condition widened to
  `err instanceof ApiError && err.status === 409 && err.message.startsWith(WORKFLOW_LOCK_DETAIL_PREFIX)`.
  No new arm, no hook, no state.
- `ChatArea.tsx`: the hydration effect gains one functional `setActiveExpert` and a guarded
  catch body; `onExpertHandoff` gains `&& !isStreaming`; the two spotlight mounts gain one prop
  expression each. **Zero new hooks.** The ledger rows themselves are not in this plan's
  `files_modified` (docs/HOT-FILE-LEDGER.md / CLAUDE.md), so recording them there is left to the
  orchestrator.

## D-15 banner-testid note (out of scope, cosmetic)

ChatArea's reconcile banner testid (base :1058) is derived from `status === 409`, so an org-mismatch
409 still renders under `data-testid="workflow-lock-error-banner"` — but its TEXT is now the
server's sentence and the draft is stashed. Unchanged by D-15's scope; a 279-04 / D-13 drive that
reads the banner should read its text, not its testid.

Also recorded: `StreamsProvider.stopping.test.ts:1018` and `streamsProvider_state01b_403.test.tsx:171`
reject with `new ApiError("locked", 409)`. They now exercise the GENERIC arm (no lock prefix) and
stay green because both arms roll back both temps and set a 409 banner — their "409 lock arm is
unaffected" titles are now weaker than they read. Not in this plan's files; left for the reviewer.

## Deviations from Plan

- **[Rule 3 - Blocking] Worktree base reset.** Landed on `8764137fe`; reset to `10596004b` as instructed.
- **ExpertDetailModal copy has no test pin.** "will not be searched" is covered only by the WR-04
  grep: `ExpertDetailModal.test.tsx` is not in `files_modified`, so no assertion was added there.
- **Commit E spotlight arm reuses the existing effect and state** (a restricted branch inside the
  one `useEffect`) rather than a second effect, so the card gains no hook; `folderId` and `threadId`
  are in the deps. ChatArea's empty-thread mount uses `thread?.folder_id ?? null` / `thread?.id ?? null`
  (the existing mount already used `thread?.`).
- **Commit E added a ChatArea-level case (11b)** proving the empty-thread mount passes
  `(id, thread.id, folder)` — the plan only specified spotlight-level cases.
- **Commit F corrected ExpertCatalogPage case (8) beside its original** (`mock.calls[0]` was `[]`,
  now `[true, false]`) and the page docblock's "still with no arguments" sentence beside its
  original — both necessarily changed by `listExperts(true, false)`.
- **`graphify update .` NOT run in the worktree**: it rewrites tracked `graphify-out/` files outside
  `files_modified`; run it once after the wave merges.

## Threat surface

No new endpoint, auth path or schema. T-279-14: every new server-detail render (invite preview
error, catalog start error, the generic send banner) is a React text child, never HTML.
T-279-15 / T-279-16 / T-279-18 mitigated as planned (cases (20), Test 3b/3c, (22)).

## Known Stubs

None.
