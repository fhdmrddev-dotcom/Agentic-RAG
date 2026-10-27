---
phase: 297-every-view-has-an-address
plan: 01
subsystem: ui
tags: [frontend, refactor, g5-extraction, fences, react]

requires:
  - phase: 289
    provides: "the ?run= deep link the moved initializer still reads (retired by 297-02)"
provides:
  - "frontend/src/hooks/useAppNavigation.ts — App's view/tab state + navigators (useState, moved verbatim), interface AppNavigation"
  - "frontend/src/components/layout/AppViewSwitch.tsx — pure, hook-free ActiveView mount switch (moved verbatim)"
  - "8 source fences re-targeted to the new homes under D-297-01..08 (none retired)"
affects: [297-02 router core, 297-03 leave guard, 297-04 parity suite, 299 per-thread addresses]

tech-stack:
  added: []
  patterns:
    - "Verbatim extraction with same-named props: every free identifier of the moved body becomes a prop of the same name, so regex fences over the body still match"
    - "Fence re-target: change the ?raw source + self-guard identity anchor, add a 'moved, not duplicated' zero arm, never change an expect value"

key-files:
  created:
    - frontend/src/hooks/useAppNavigation.ts
    - frontend/src/hooks/__tests__/useAppNavigation.test.tsx
    - frontend/src/components/layout/AppViewSwitch.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/lib/__tests__/activeViewReachability.test.ts
    - frontend/src/__tests__/library/renameFence.test.ts
    - frontend/src/components/layout/__tests__/ChatLayout.fallback.test.tsx
    - frontend/src/components/layout/__tests__/ChatLayout.scrollFrame.test.tsx
    - frontend/src/components/layout/ChatLayout.launch.test.tsx
    - frontend/src/components/chat/__tests__/ChatArea.expertThread.test.tsx
    - frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx
    - frontend/src/pages/__tests__/LibraryPage.tabAttention.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md

key-decisions:
  - "D-297-01..08: every fence that read App.tsx / ChatLayout.tsx as ?raw for the moved code now reads the new home; none retired, no expect value changed"
  - "bounceHome is a stable useCallback around the bare view setter, so the 403 bounce still does NOT spend the Library hand-off (characterized, not changed)"
  - "The 188-09 union docblock in App.tsx is kept verbatim; one correction line sits beside it (D-38)"

patterns-established:
  - "AppViewSwitch owns no hooks; ChatLayout keeps the state, the one attention read and the one canvas read, and passes them down"

requirements-completed: [REG-09]

duration: ~35min
completed: 2026-10-27
---

# Phase 297 Plan 01: G-5 extraction of App and ChatLayout Summary

**App's view/tab state moved verbatim into `useAppNavigation` (84 lines, 0 differing), and ChatLayout's 290-line mount expression into a hook-free `AppViewSwitch` (`diff -w`: only the two enclosing-brace lines). Eight fences now read the new homes under D-297-01..08. No router code.**

## Performance

- **Duration:** about 35 min
- **Started:** 2026-10-27T17:48Z
- **Completed:** 2026-10-27T18:25Z
- **Tasks:** 3/3
- **Files:** 3 created, 13 modified

## Accomplishments

- `frontend/src/hooks/useAppNavigation.ts` (160 lines) holds these blocks, moved byte-for-byte from App.tsx: the boot initializer (`/admin/spend`, `?run=`, `?connections=1` plus its `replaceState`), the studio state with its four navigators, the Library hand-off comment block with `libraryTab` and `handleOpenLibraryHealth`, and `handleNavigate`, which is returned as `onNavigate`. The only new code is `bounceHome`, a stable `useCallback` around the bare view setter the 403 listener called before.
- App.tsx went from 422 to 340 lines. It calls `useAppNavigation()` once, at the position the old `useState` held, before every early return. The 403 listener now calls `bounceHome()`, and ChatLayout's props read `nav.*` under the same names. App still has exactly one `useEffectiveFeatures(` call. `ActiveView` is still exported on one line (D-38). One correction line sits beside the union docblock, not inside it.
- `frontend/src/components/layout/AppViewSwitch.tsx` (473 lines) is pure (no hooks) and takes 37 props, each named after an identifier in the switch body. ChatLayout went from 1158 to 882 lines and renders `<AppViewSwitch …/>` where the expression was. ChatLayout keeps `doRun`, `openRunSurface`, the one `useEffectiveFeaturesOptional()` read (`canvasEnabled`, passed down), the one `ATTENTION_PRODUCERS.flatMap`, the drawer, the history column and ChatLaunchForm.
- New characterization suite `useAppNavigation.test.tsx` with 13 cases, written RED first and pinned in both count-gate knobs.

## The `diff -w` proof (Task 2)

`orig-expr` is the expression cut from ChatLayout.tsx at base `246d62750`, lines 840-1129. `new-body` is AppViewSwitch's `return` body.

```
1c1
<       {activeView === "chat" ? (
---
>       activeView === "chat" ? (
290c290
<       )}
---
>       )
```

Both are 290 lines, and only the two enclosing-brace lines differ. The App side was checked line by line by a script that compares base App.tsx lines 156-171 and 173-240 with the hook body: `old 84 lines, new 84 lines, 0 differing lines`.

## Fence-to-id map (all re-targeted, none retired)

| Id | Suite | Change |
|---|---|---|
| D-297-01 | `src/lib/__tests__/activeViewReachability.test.ts` | layout source → `AppViewSwitch.tsx?raw`; self-guard `export function AppViewSwitch`; App.tsx stays the members source; still 11 cases. **re-targeted** |
| D-297-02 | `src/__tests__/library/renameFence.test.ts` | adds `SWITCH`: case (b), the `activeView === "documents"` → `<LibraryPage onNavigate={onNavigate}` key link (same 120-char window) and the page-import arm read SWITCH; `LAYOUT.length > 20000` and the ChatLayout identity check stay; App's needle is unchanged. **re-targeted** |
| D-297-03 | `src/components/layout/__tests__/ChatLayout.fallback.test.tsx` | reads AppViewSwitch.tsx and adds a one-home arm: ChatLayout's stripped code has no `<UnknownViewFallback` and does have `<AppViewSwitch`. Pin 4 → 5. **re-targeted** |
| D-297-04 | `src/components/layout/__tests__/ChatLayout.scrollFrame.test.tsx` | links 2-3 read AppViewSwitch.tsx with the same regexes; titles renamed to "AppViewSwitch's grid track / `<main>`". **re-targeted** |
| D-297-05 | `src/components/layout/ChatLayout.launch.test.tsx` | `SWITCH_CODE` now drives the stripper NEEDLE check (raw > stripped, stripped `=== 1`), branch-before-fallback, the split point and the `onOpenRun=` gate. The doRun cases stay on `CHAT_LAYOUT_CODE`. Wrong-id needles are also checked on the switch. **re-targeted** |
| D-297-06 | `src/components/chat/__tests__/ChatArea.expertThread.test.tsx` | is now two-ended: ChatLayout has `patchThread={patchThread}` and AppViewSwitch has `onThreadUpdated={patchThread}`. **re-targeted** |
| D-297-07 | `src/pages/__tests__/LibraryPage.initialTab.test.tsx` | the clearing-rule wiring reads `useAppNavigation.ts?raw` (identity `export function useAppNavigation`, the NO TWELFTH raw-vs-code pair, `libraryTabAfterNavigate`, `setLibraryTab(` ≥ 2). The App arms stay: no `onNavigate={setActiveView}`, App length > 4000, App calls `useAppNavigation()`. **re-targeted** |
| D-297-08 | `src/pages/__tests__/LibraryPage.tabAttention.test.tsx` | `setLibraryTab(` is exactly 2 in the hook and exactly 0 in App (moved, not duplicated). The `<LibraryPage…attentionConditions` mount arm reads the switch. ChatLayout must pass `attentionConditions` into `<AppViewSwitch`, and `flatMap === 1` is still asserted on ChatLayout. **re-targeted** |

**No existing `expect` value changed.** No length floor had to be lowered. The hook is 9,866 characters raw, so the initialTab suite's `> 4000` floor still applies to it unchanged; the measurement is written in the test comment.

Re-run without edits, all green: `ChatLayout.badge`, `ChatLayout.orgRefetch`, `ChatLayout.startChat`, `ChatLayoutLaunch`, `ChatLayout.runDeepLink`, `NavPanel`, `WorkflowBuilderPage.header` (still exactly one `useEffectiveFeatures(` in App).

## Gates (wave 1, run once)

- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, from the worktree root): `count gate OK — 524/524 pinned files present, no per-file decrease, 0 failing.` Total 12250, pinned total 11077. Per-file (pin → actual) for every suite this plan touched: useAppNavigation 13 → 13 (new) · activeViewReachability 11 → 11 · renameFence 15 → 15 · ChatLayout.fallback 5 → 5 (pin raised from 4) · ChatLayout.scrollFrame 6 → 6 · ChatLayout.launch 38 → 39 · ChatArea.expertThread 18 → 27 · LibraryPage.initialTab 6 → 15 · LibraryPage.tabAttention 15 → 15 · ChatLayout.badge 5 → 10 · NavPanel 20 → 20 · WorkflowBuilderPage.header 32 → 71. Every actual is at or above its pin. Where actual is above the pin, this plan added no `it` cases; those are existing pins sitting below the suite's count, not growth from this plan.
- **Typecheck** (`npx tsc -p tsconfig.app.json --noEmit`): comparing the set of errors after each task with the base set (54 unique lines captured before the first edit) shows **0 new**.
- **eslint** on the changed source and test files: the only finding is `ChatLayout.tsx` `'_loading' is assigned a value but never used`. That line is unchanged from base, so the finding is inherited.
- `node scripts/check-hot-file-ledger.cjs 297` OK · `node scripts/check-claude-md-size.cjs` OK (102,115 chars) · `node scripts/check-docs-coverage.cjs` OK.
- `git diff --stat 246d62750 HEAD -- StreamsProvider.tsx WorkflowBuilderPage.tsx NavPanel.tsx` is empty.

## Task Commits

1. **Task 1 RED:** `53cd0c903`, `test(297-01): characterize useAppNavigation before the move`. The suite failed because the module did not exist yet.
2. **Task 1 GREEN:** `c868b317e`, `refactor(297-01): move App view/tab state into useAppNavigation (D-01)`
3. **Task 2:** `9401ae3fe`, `refactor(297-01): move the ActiveView mount switch into AppViewSwitch (D-01)`
4. **Task 3:** `45d7e3ba6`, `docs(297-01): ledger + FIRING cells for the G-5 extraction`

## Ledger

- `useAppNavigation.ts` is measured at `1 / 1 / 160` and `AppViewSwitch.tsx` at `1 / 1 / 473`. Each AT-PLANNING row was replaced, and each section now lists its binding invariants.
- `App.tsx` is now `39 / 29 / 340` (was `37 / 28 / 422`) and `ChatLayout.tsx` is `65 / 34 / 882` (was `64 / 33 / 1158`). Both scan-list rows and both CLAUDE.md FIRING cells (≤ 80 chars) were updated in the same commit, with a "Phase 297 (297-01)" subsection per file. The replaced cells were moved into those subsections word for word.

## Deviations from Plan

### Literal acceptance greps that read prose

**1. `grep -c "useState<ActiveView>" frontend/src/App.tsx` returns 1, not 0.**
- The match is in the 188-09 union docblock ("a `useState<ActiveView>` switch + a matching render branch"). That docblock is the same paragraph that holds the renameFence needle, and the plan requires corrections to go *beside* it, never *through* it. There are 0 matches in code. I kept the docblock as it was and added the correction line next to it. No functional impact.

**2. `grep -rn "react-router" frontend/src … | grep -v __tests__` prints one line.**
- The line is `pages/librarySelection.ts:63`, the pre-existing comment "state-based (no react-router)". It is unchanged from base and is not an import. No product file imports a router. The new hook's `?raw` fence asserts the same thing for the hook.

### Rule 2 additions (strengthened fences, no expect value changed)

- renameFence: added a SWITCH identity anchor and a SWITCH length floor (> 20000; the file is about 27k chars), and kept `<IngestionPage` absence asserted on ChatLayout as well as the switch.
- launch test: the wrong-id needles are now checked on AppViewSwitch too, because the run room's mount moved there.
- tabAttention: in addition to the plan's loose `toContain`, a regex now requires that `attentionConditions={attentionConditions}` sits on the `<AppViewSwitch` mount. NavPanel's prop alone would have satisfied the loose check.

Otherwise the plan executed as written.

## Issues Encountered

- One mixed run reported 2 render-case timeouts in `LibraryPage.initialTab.test.tsx` ("lands on Documents with NO prop…", "lands on Health when the CALLER asks…"); the first case took 16.9 s on a cold environment. Run alone, the suite passed 15/15, and it passed in the full count gate. Those cases mount LibraryPage and never read App or the hook, so the failures came from load, not from this change.
- The worktree sandbox blocks compound bash commands that touch git, so verification scripts ran as separate commands or as scratchpad node scripts taking path arguments.
- `graphify update .` was not run inside the worktree, to keep `graphify-out/` churn out of the agent branch. The orchestrator can run it after merging.

## Known Stubs

None.

## TDD Gate Compliance

RED commit `53cd0c903` (`test(297-01)`) comes before GREEN commit `c868b317e` (`refactor(297-01)`); the GREEN work is a behaviour-neutral move, so its type is `refactor`, not `feat`. RED was confirmed failing: the module did not exist.

## Self-Check: PASSED

- FOUND: frontend/src/hooks/useAppNavigation.ts, frontend/src/hooks/__tests__/useAppNavigation.test.tsx, frontend/src/components/layout/AppViewSwitch.tsx
- FOUND commits: 53cd0c903, c868b317e, 9401ae3fe, 45d7e3ba6

## Next Phase Readiness

297-02 lands on two small seams. Router hooks go only into `useAppNavigation` (D-08). The not-found and holding arms go inside AppViewSwitch's non-chat ternary as its first arm, and the stripped `workflow-run` comparison must stay at exactly one (Pitfall 6). 297-02 must also delete the moved `replaceState` (App's old `:169`, now in the hook) and ChatLayout's `?run=` clear effect (D-18/D-33).
