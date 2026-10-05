---
phase: 271-find-the-document
plan: 02
subsystem: frontend / Library
tags: [library, filing-rules, ask-handoff, find, navigation, a11y]
requires: []
provides:
  - "askInChat(deps, question): Promise<boolean> — ordered Ask handoff (new thread → prefill → navigate, never send)"
  - "LibraryPage optional prop onAskInChat (typed only; consumed by 271-04)"
  - "LibraryHeaderBar optional prop onOpenFilingRules"
  - "ClassificationRulesPage({ onBack }) — the single-shape Filing rules sub-view"
  - "FindModeSwitch (FindMode), FindMetaLine, AskHandoffCard — props-only building blocks for 271-04"
affects:
  - "App.tsx ActiveView union (12 members, `classification-rules` removed)"
  - "NAV_ITEMS (7 entries)"
tech-stack:
  added: []
  patterns:
    - "dependency-injected ordered handoff (startScopedChat.ts precedent)"
    - "Library-local sub-view kept beside a hidden-but-mounted tab shell (Back restores the origin tab without storing it)"
    - "radiogroup with roving tabindex for a non-tab segmented control"
key-files:
  created:
    - frontend/src/components/library/find/askInChat.ts
    - frontend/src/components/library/find/FindModeSwitch.tsx
    - frontend/src/components/library/find/FindMetaLine.tsx
    - frontend/src/components/library/find/AskHandoffCard.tsx
    - frontend/src/components/library/find/__tests__/askInChat.test.ts
    - frontend/src/components/library/find/__tests__/FindModeSwitch.test.tsx
    - frontend/src/components/library/find/__tests__/FindMetaLine.test.tsx
    - frontend/src/components/library/find/__tests__/AskHandoffCard.test.tsx
    - frontend/src/pages/__tests__/LibraryPage.filingRules271.test.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/lib/nav-items.ts
    - frontend/src/lib/nav-items.test.ts
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx
    - frontend/src/components/library/LibraryHeaderBar.tsx
    - frontend/src/components/library/__tests__/LibraryHeaderBar.test.tsx
    - frontend/src/components/classification/ClassificationRulesPage.tsx
    - frontend/src/components/classification/ClassificationRulesPage.test.tsx
    - frontend/src/components/classification/RuleBuilderPanel.tsx
    - frontend/src/components/classification/RuleBuilderPanel.test.tsx
    - frontend/src/components/ingestion/AutomationGroup.tsx
    - frontend/src/components/ingestion/AutomationGroup.test.tsx
decisions:
  - "D-09 applied: the classification-rules ActiveView member, its ChatLayout branch and its NAV_ITEMS entry were removed in ONE commit (b987bfb27); activeViewReachability + renameFence stay green"
  - "P-07 applied: ClassificationRulesPage has ONE shape (no `embedded` flag) — no outer padding, header row Back · Filing rules · subtitle · New rule"
  - "P-08 applied: askInChat creates a NEW thread before setting the prefill; a rejected create sets nothing and navigates nowhere; there is no send seam"
  - "Filing rules sub-view hides (not unmounts) the pagehead + ReembedSearchPointer + Tabs wrapper, so Back restores the origin tab and its state with no stored origin"
  - "LibraryHeaderBar's Filing rules tooltip carries its own TooltipProvider, because the header renders standalone in its suites and Radix throws without one"
metrics:
  duration: "~35 min"
  completed: 2026-10-03
  tasks: 3
  files: 23
---

# Phase 271 Plan 02: Filing rules home + Ask exit + Find building blocks Summary

The rail's Classification home is retired into a **Filing rules** sub-view opened from the Library header, Ask gains a tested exit (`askInChat`: new thread → prefill → navigate, never send) wired from `ChatLayout` to `LibraryPage`, and the three props-only Find components (`FindModeSwitch`, `FindMetaLine`, `AskHandoffCard`) exist for 271-04 to compose.

## What was built

### Task 1 — triad retired, Ask exit wired (D-02, D-09, P-08)
- `askInChat.ts`: `AskInChatDeps { createThread, setPrefill, navigate }`; trims; whitespace → `false` with no calls; a rejected create logs once and resolves `false` with no prefill and no navigation.
- ONE commit (`b987bfb27`) removes `"classification-rules"` from `ActiveView`, the `ClassificationRulesPage` import + branch from `ChatLayout`, the `NAV_ITEMS` entry (and the now-unused `Wand2` import), and the member from `LibraryPage.initialTab.test.tsx`'s destination list. `UnknownViewFallback` untouched.
- `ChatLayout`: `handleAskInChat` beside `handleTryInChat` (comment says why it does not copy it); ` onAskInChat={handleAskInChat}` appended at the END of the one-line `<LibraryPage … />` mount, nothing between the branch and the mount (renameFence's 120-char window holds).
- `LibraryPage`: `onAskInChat?: (question: string) => Promise<boolean> | void` on the props TYPE only (not destructured — 271-04 does).
- `nav-items.test.ts`: the "EIGHTH entry" case re-pinned IN PLACE (same `it` count, 5) to `toBe(7)` plus no `classification-rules` entry.

### Task 2 — Filing rules inside the Library (D-08, D-09, P-07)
- `LibraryHeaderBar`: optional `onOpenFilingRules`; the right side is one `ml-auto flex items-center gap-2` cluster (ml-auto moved off the pill); the link renders first — ghost button, `Wand2` + label (hidden below md) + `ChevronRight`, `aria-label="Filing rules"`, `min-h-[44px] md:min-h-0`, tooltip "Filing rules". Tablist block untouched; `role="tab"` count unchanged (2 → 2).
- `ClassificationRulesPage({ onBack })`: root `flex h-full flex-col overflow-hidden` (no outer padding); header row Back (`ChevronLeft` + "Library", only with `onBack`) · `<h1>Filing rules</h1>` · shipped subtitle verbatim (`hidden lg:block`) · New rule (`ml-auto`). List, scope filter, builder grid and states unchanged. Docblock rewritten.
- Renames: `RuleBuilderPanel` "New filing rule" and "After extraction"; `AutomationGroup` "No filing rules yet".
- `LibraryPage`: `filingRulesOpen` state; the pagehead + ReembedSearchPointer + `<Tabs>` shell wrapped in one container that is `hidden` while open (kept mounted); `ClassificationRulesPage` mounted as its sibling — its only mount now. Guarded subtitle literal and `${tab}-pagehead` hook byte-unchanged.

### Task 3 — Find building blocks (D-01, D-02, D-03)
- `FindModeSwitch`: `radiogroup` "Search mode", two `radio`s, accent on the checked one, roving tabindex, Left/Right move + select with wrap; no tab role anywhere.
- `FindMetaLine`: polite live count ("N documents" / "1 document" / warning "0 documents" / status "Searching…"), "Sorted by" + shadcn `Select` (`aria-label="Sort results"`, options passed in), dot + "Exact match on fields. No AI ranking.", optional "Searching every folder you can see.", "Clear search" `ml-auto`. No fetch, no `@/lib/api` import.
- `AskHandoffCard`: title + body verbatim, question line only when non-empty, "Open in chat" (disabled when empty) calls `onAskInChat(trimmed)` once, handoff note; no list/table markup, no I/O.

## Verification

| Check | Result |
|---|---|
| Task 1 RED | askInChat: `Failed to resolve import "../askInChat"`; nav-items: `AssertionError: expected 8 to be 7` |
| Task 2 RED | 12 failing cases (header link absent, old strings, no Back, `p-8`, LibraryPage sub-view absent) |
| Task 3 RED | all three suites: import resolution failure (components absent) |
| Task 1 GREEN | askInChat 5/5, nav-items 5/5, activeViewReachability + renameFence green |
| Task 2 GREEN | `LibraryHeaderBar`, `src/components/classification`, `AutomationGroup`, `LibraryPage.filingRules271`, `renameFence` — **69/69** |
| Task 3 GREEN | `src/components/library/find/__tests__` — **27/27** (4 files) |
| NavPanel suites (rail consumers of NAV_ITEMS) | 28/28, twice, with this plan's nav-items |
| tsc `-p tsconfig.app.json` set diff | base 70 errors, after 70; **NEW: none, GONE: none** |
| Acceptance greps | `classification-rules` in non-test non-comment code (excl. api/knowledge.ts): none · `onAskInChat={handleAskInChat}` on the LibraryPage line: 1 · old strings in `.tsx` non-test: none · `p-8` in ClassificationRulesPage: 0 · `Filing rules` there: 3 · `role="tab"` in LibraryHeaderBar: 2 at base, 2 now · FindModeSwitch `role="tab"` 0 / `radiogroup` 1 · deterministic line 1 · fetch/api imports 0 · forbidden vocabulary 0 |
| Triad in one commit | `git show --stat b987bfb27` lists App.tsx, ChatLayout.tsx, nav-items.ts, LibraryPage.initialTab.test.tsx (+ askInChat.ts, LibraryPage.tsx) |

### Inherited / load reds (not caused by this plan — measured, not assumed)
The box ran ~50 node processes (sibling wave agents) throughout; every red below is a 5000 ms timeout and the failing set changed between runs.
- `src/pages/__tests__/LibraryPage.initialTab.test.tsx` (first 2-3 cases) and `src/pages/__tests__/LibraryPage.test.tsx` (first 2-4 cases): both use `await import("@/pages/LibraryPage")` inside the first case. **Re-run with the BASE versions of `LibraryPage.tsx`, `LibraryHeaderBar.tsx` and the initialTab test swapped in: the same timeouts reproduced (3 and 4 failures)** — inherited, then files restored. The new `LibraryPage.filingRules271` suite imports statically and passes.
- `ProfileMenu.test.tsx`, `ChatHistoryColumn.test.tsx`, `ChatHistoryColumn.a11y.test.tsx`: provably unmodified by this plan and import nothing it touched; timeouts in Radix-menu user-event cases.
- `NavPanel` suites, `ClassificationRulesPage` "edit", `AutomationGroup` "kebab": red in some concurrent runs, green alone (NavPanel 28/28 twice; classification + AutomationGroup green in two separate runs).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Local `TooltipProvider` around the header link's tooltip**
- **Found during:** Task 2
- **Issue:** Radix `Tooltip` throws without a provider; `LibraryHeaderBar` renders standalone in its own suite (and could under any caller without the app-level provider).
- **Fix:** the link's `Tooltip` is wrapped in its own `TooltipProvider` (nested providers are legal).
- **Files modified:** `frontend/src/components/library/LibraryHeaderBar.tsx` · **Commit:** 8a7c118f5

**2. [Rule 1 - Bug, own test] The "link on every tab" case counted the Ingestion body's child tabs**
- **Found during:** Task 2 GREEN (`expected 9 to be 5`)
- **Fix:** the case counts tabs `within(library-headerbar)` — the header's tablist is the five; Ingestion owns its own child tabs by design.
- **Commit:** 8a7c118f5

**3. [Acceptance-driven wording] Comment text adjusted so literal-count greps stay honest**
- The `LibraryHeaderBar` docblock originally spelled the tab-role attribute literally (raising the `role="tab"` count 2 → 3) and the `ClassificationRulesPage` render comment spelled the padding class; both reworded so the counts measure code, not prose.

**4. [Choice within plan] `createThread: () => newThread()` instead of passing `newThread` directly**
- `newThread(folderId?, expertId?)` — the wrapper guarantees the Ask thread is created with no folder and no Expert regardless of how the helper calls it.

**5. [Choice within plan] Filing rules sub-view header mirrors the Library row's style**
- Header row uses the Library row's `border-b border-border/50 px-1 pb-3 mb-4` and the subtitle uses its `hidden lg:block truncate text-xs` treatment (UI-SPEC S2: "the same height as the Library row"), rather than the shipped `text-sm mt-1.5` block.

## Known Stubs

- `LibraryPage`'s `onAskInChat` prop is typed but not yet destructured or rendered — **intentional per plan**; 271-04 composes the Documents-tab Find/Ask surface (FindModeSwitch, FindMetaLine, AskHandoffCard) and consumes it. Until then Ask has no visible entry in the Library.

## Owed / hand-offs
- **271-04** must adopt this plan's new suites into the vitest count gate (`askInChat`, `FindModeSwitch`, `FindMetaLine`, `AskHandoffCard`, `LibraryPage.filingRules271`) and record the new case counts for `LibraryHeaderBar` (+4), `ClassificationRulesPage` (+3) and `RuleBuilderPanel` (+1). `scripts/vitest-count-gate.cjs` was NOT edited (271-03 owns it in wave 1).
- Hot-file ledger rows for `LibraryHeaderBar.tsx`, `ChatLayout.tsx`, `App.tsx`, `nav-items.ts`, `LibraryPage.tsx`, `RuleBuilderPanel.tsx` were NOT edited (plan forbids touching `docs/HOT-FILE-LEDGER.md` / `CLAUDE.md`); the orchestrator/close owns that sync.
- G-4 scenario 3 (live Chrome drive: Ingestion → Filing rules → back) is owed at phase verification; covered structurally here by `LibraryPage.filingRules271`.

## Threat Flags

None — no new network endpoint, auth path or schema change. T-271-08 (Ask auto-sent under another thread) mitigated by `askInChat`'s tested order and absence of a send seam; T-271-09 (dead view / stale nav entry) mitigated by the one-commit triad removal with `activeViewReachability` + `renameFence` green; T-271-10 accepted (unchanged `listRules()` path, proven by the sub-view test loading an existing rule).

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | a08c131a0 | test(271-02): add failing tests for the Ask handoff and the seven-entry rail |
| 1 GREEN | b987bfb27 | feat(271-02): retire the classification-rules view and give Ask its exit into a new chat |
| 2 RED | b0a6dbac3 | test(271-02): add failing tests for Filing rules inside the Library |
| 2 GREEN | 8a7c118f5 | feat(271-02): Filing rules opens inside the Library from a header link |
| 3 RED | 1790c94bc | test(271-02): add failing tests for the Find mode switch, meta line and Ask card |
| 3 GREEN | 3fd3c950d | feat(271-02): Find mode switch, meta line and Ask handoff card |

## TDD Gate Compliance
Each task has a `test(271-02)` commit followed by a `feat(271-02)` commit; RED failures were observed before every GREEN.

## Self-Check: PASSED
- All 5 created source/test files listed above exist on disk.
- All 6 commits (a08c131a0, b987bfb27, b0a6dbac3, 8a7c118f5, 1790c94bc, 3fd3c950d) are in `git log 20050816d..HEAD`.
- No file deletions in the plan's commits.
