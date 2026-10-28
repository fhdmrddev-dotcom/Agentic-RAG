---
phase: 299-links-to-the-thing-itself
plan: 02
subsystem: frontend / routing + thread selection + workflow and Expert pages
tags: [frontend, routing, addresses, threads, workflows, experts]
requires:
  - 299-01
  - 299-05
provides:
  - "appRoutes.ts: AppRoute gains {view:'chat'; threadId}, {view:'workflows'; definitionId}, {view:'experts'; bundleId} (strict lowercase UUID; id-less forms unchanged)"
  - "useAppNavigation().entityLink: { target, route, openThread(id, opts?), openWorkflow(id), openExpert(id), leaveThread() } (exported type EntityLink)"
  - "handleNavigate('chat') → /app/chat/<last thread> when one was seen, else /app; a no-op on any chat address"
  - "hooks/useThreadAddress.ts: { openThread(thread), holding }"
  - "WorkflowsPage prop linkedDefinitionId; ExpertCatalogPage prop openBundleId; ChatLayout prop entityLink; AppViewSwitch props openThread / threadHolding / entityLink"
  - "library/useWorkflowLinkTarget.ts (LINK_TARGET_MARK_MS = 2000) and catalog/useExpertLinkTarget.ts"
  - "WorkflowCard root carries data-row-id={row.id}"
affects: [299-03, 299-04]
tech-stack:
  added: []
  patterns:
    - "one entity navigator object from the ONE router-hook module, handed down as a prop"
    - "one effect that decides from what CHANGED (a seen-ref), never two effects that each own half"
    - "open-by-id hooks that call only local openers / focus / a read, pinned by an auto-mocked API module"
key-files:
  created:
    - frontend/src/hooks/useThreadAddress.ts
    - frontend/src/hooks/__tests__/useThreadAddress.test.tsx
    - frontend/src/components/workflows/library/useWorkflowLinkTarget.ts
    - frontend/src/components/workflows/library/__tests__/useWorkflowLinkTarget.test.tsx
    - frontend/src/components/experts/catalog/useExpertLinkTarget.ts
    - frontend/src/components/experts/catalog/__tests__/ExpertCatalogPage.link.test.tsx
  modified:
    - frontend/src/lib/appRoutes.ts
    - frontend/src/lib/__tests__/appRoutes.test.ts
    - frontend/src/__tests__/routing/appRouteParity.test.ts
    - frontend/src/hooks/useAppNavigation.ts
    - frontend/src/hooks/__tests__/useAppNavigation.test.tsx
    - frontend/src/App.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/AppViewSwitch.tsx
    - frontend/src/__tests__/routing/navigationKeepsStreams.test.tsx
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/components/workflows/library/WorkflowCard.tsx
    - frontend/src/components/workflows/library/__tests__/__snapshots__/WorkflowCard.seam286.pin.test.tsx.snap
    - frontend/src/components/workflows/library/librarySubtree.fences.test.ts
    - frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
    - .claude/skills/sketch-findings-agentic-rag/SKILL.md
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "useThreadAddress is ONE effect, not the plan's Effect 1 + Effect 2: the address and the selection often change in the same commit, and two effects acting on their halves is the Pitfall-4 ping-pong"
  - "The IN-01 guard is a window (opened by an org change, closed by the first deselect or the new list settling), because IN-01's selectThread(null) lands one commit after the org change"
  - "A thread picked off the chat view wins when chat is entered; the stale address is corrected with a REPLACE, so 'select, then onNavigate(chat)' still writes one entry"
  - "go() moves lastThreadId synchronously with the write; seeing the chat home clears it"
  - "entityLink.openThread takes an optional { replace } (additive; 299-03 / 299-04 names unchanged)"
  - "Without App's entityLink the hook is inert and openThread is the pre-299 select + onNavigate('chat') pair, so no ChatLayout / launch / startChat fence needed re-targeting"
  - "The WorkflowCard seam286 pin .snap is committed with its five data-row-id insertions (the 290-02 precedent)"
metrics:
  duration: "~1h45m"
  completed: 2026-10-28
  tasks: 3
  commits: 6
---

# Phase 299 Plan 02: Links to the thing itself (threads, workflows, Experts) — Summary

A chat, a workflow, a run or an Expert in the active org now opens from its own address. The
address survives a refresh and opens the same item in a new tab.

- `/app/chat/<uuid>` selects that thread once the chat list has answered. Until then it shows "Opening the chat…", never the empty welcome composer.
- `/app/workflows/<uuid>` opens an owned draft in the Builder, or focuses a visible published card.
- `/app/experts/<uuid>` opens that Expert's detail.
- `/app/runs/<uuid>` (from 297) is now also reported as an entity.

Picking a thread, New chat and a launch each write exactly one history entry. Back moves the
selection without writing one. A live stream keeps running through all of it.

## What was built

**Task 1: the route table and the navigators** (`3bb1fe71a` RED, `f92cdaedd` GREEN)
- `appRoutes.ts`:
  - Three id-bearing variants were added beside `runs` / `skills`.
  - `formatAppRoute` narrows with `"threadId" in route`, so `{view:"chat"}` is still `/app` and a thread is never the home.
  - The legacy `?run=` alias now applies to the chat home only.
  - Imports are unchanged.
- `useAppNavigation.ts`:
  - Returns one new key, `entityLink`. It keeps one identity while the address is unchanged.
  - `go` refuses a non-UUID entity id.
  - `lastThreadId` makes the rail's Chat return to the open thread. It is updated synchronously in `go` and cleared when the chat home is seen.
- `App.tsx`: one prop, `entityLink={nav.entityLink}`.
- `ChatLayout` got its optional Props field (type only) in this commit, so the commit typechecks.

**Task 2: the open thread lives in the address** (`a832b65fb` RED, `fed2dbedd` GREEN)
- `useThreadAddress.ts` (new, 176 lines) binds the selection and the address both ways in one effect, in this order:
  1. An off-chat pick wins when the chat view is entered.
  2. The address drives the selection.
  3. The selection drives the address: a pick pushes, and a person's deselect replaces with `/app`.
  - The thread list is read through a ref, so a refetch never re-runs the binding.
  - An org change opens a window, so IN-01's reset never drops the address.
  - It returns `holding`.
- `ChatLayout.tsx`:
  - One `useThreadAddress(...)` call.
  - The `threadNavigation` memo moved below the org read (unchanged except `openThread`).
  - The `doRun` tail is now `opts?.beforeNavigate?.(); openThread(thread)`.
  - Three pass-through props to AppViewSwitch.
  - No new `useState` or `useEffect`, and the IN-01 effect is not edited.
- `AppViewSwitch.tsx`:
  - The chat `<main>` renders `<AddressHolding sentence="Opening the chat…" />` while `threadHolding` is true. The grid and `<main>` class strings are unchanged.
  - The Expert start-chat path uses `openThread`.

**Task 3: open a workflow or an Expert from its id** (`bf7283e9c` RED, `153851d46` GREEN)
- `useWorkflowLinkTarget.ts`:
  - An owned draft goes to `onOpenDraft(thatRow)`, so its concurrency field travels with it.
  - A visible published or starter row: the project filter is cleared, then `[data-row-id]` is scrolled into view, focused and marked for 2 s. If the card has not rendered yet, the hook retries when the rows change.
  - It acts once per id and imports no client API.
- `useExpertLinkTarget.ts`: opens from the list, otherwise from one `getExpert(id)`. It acts once per id, and a late answer is dropped.
- Wiring:
  - `WorkflowsPage` gets one prop and one hook call, placed below `onOpenDraft` (the TDZ rule).
  - `WorkflowCard` gets one `data-row-id={row.id}`.
  - `ExpertCatalogPage` gets one prop and one hook call.
  - `AppViewSwitch` passes the kind-checked ids from `entityLink`.
- `SKILL.md`: a dated 299-02 correction sits beside the 297 "are Phase 299" line, which is kept.

## Gate results

- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, repo root), verbatim: `count gate OK — 556/556 pinned files present, no per-file decrease, 0 failing.`
  - Totals: `total 12978 · failed 0 · pinned total 11829`.
  - Per-file deltas for this plan's suites are all 0 (pinned = actual):

  | Suite | Pinned = actual |
  |---|---|
  | `librarySubtree.fences` | 153 |
  | `appRoutes` | 144 |
  | `appRouteParity` | 91 |
  | `useAppNavigation` | 63 |
  | `useThreadAddress` | 21 |
  | `WorkflowCard.seam286.pin` | 21 |
  | `useWorkflowLinkTarget` | 12 |
  | `ExpertCatalogPage.link` | 11 |
  | `navigationKeepsStreams` | 4 |

  - 299-05's inherited docs-coverage red was already closed at the base (`1b3be6cc8`).
- **Typecheck set-diff** (`npx tsc -p tsconfig.app.json --noEmit`): base `a25fea958` has 61 errors, the same set as `593068492` per 299-05. After each task: **new 0, gone 0**.
- **Targeted suites:**
  - Task 1: 10 files, 404 tests, including the D-05 legacy cold loads (`ChatLayout.runDeepLink`, `SetupWizard`, `noRawHistoryWrites`, `useAppNavigation.leaveGuard`, `returnTo`).
  - Task 2: every suite naming ChatLayout, AppViewSwitch, useAppNavigation, ThreadCommandPalette or startScopedChat — 38 files, 856 tests, green with no edits.
  - Task 3: 57 files, 1311 tests across `workflows/library`, the WorkflowsPage suites, `experts` and `layout`.
- **Ledger gate:** `ledger gate OK — every watched file has a row.`
- **CLAUDE.md size gate:** `claude-md size gate OK`. Every new CLAUDE.md cell is ≤ 80 chars.
- **Acceptance greps:**
  - The three `head === "…" && isStrictUuid(id)` arms: 1 each.
  - `appRoutes.ts` import count: 3, the same as base.
  - `useLocation` / `useNavigate` outside `useAppNavigation.ts`: test files only.
  - `entityLink={nav.entityLink}` in App: 1.
  - `useThreadAddress(` in ChatLayout: 1. New `useState(` / `useEffect(` lines in ChatLayout: 0.
  - `git diff 593068492 -- StreamsProvider.tsx`: empty.
  - `setViewingThread(` callers: `ChatArea.tsx` only (plus one pre-existing comment in `DevTwoPaneMock.tsx`).
  - AppViewSwitch React hooks: 0.
  - `useWorkflowLinkTarget(` in WorkflowsPage: 1, and `linkedDefinitionId` appears 3 times.
  - `data-row-id={row.id}`: 1. `useExpertLinkTarget(`: 1.
  - `WorkflowsPage` named in `useWorkflowLinkTarget.ts`: 0.
  - `299-02` in SKILL.md: 1, and the original line is kept.
  - The plan's `setLibraryTab(` grep reads 3 at base and now: the third hit is a ` * ` docblock line its `//` filter does not strip. The comment-stripped count is still 2.

## Deviations from Plan

### Reasoned deviations

1. **[Rule 1 – design bug] One effect instead of Effect 1 + Effect 2** (`useThreadAddress.ts`).
   - The address and the selection often change in the same commit: a pick that navigates, or Back after a pick. Two effects would each act on their half and fight.
   - The deps are the inputs only: address, selected id, view, pending and org.
   - The list-refetch property is pinned.
2. **[Rule 1 – design bug] The IN-01 guard is a window, not "the org is unchanged since the last run".**
   - IN-01's `selectThread(null)` lands one commit after the org change. By then the effect has already recorded the new org, because `pending` flips in the same render.
   - So a last-run comparison would treat IN-01's null as a person's deselect and drop `/app/chat/<id>`.
   - Removing the guard was tried as a planted defect: 3 cases fail. The code was restored.
3. **[Rule 1 – design bug] A stale thread on "select, then onNavigate('chat')".**
   - Ask in chat, the palette, the run page and an Expert start all select or create a thread off the chat view, then call the rail's Chat.
   - With only `lastThreadId`, that would push the previous thread and then re-select it.
   - Fix: the hook records an off-chat pick, and when chat is entered it corrects the address with `openThread(id, { replace: true })`. That is one entry.
   - `go` also moves `lastThreadId` synchronously. Removing the pick arm was tried as a planted defect: 1 case fails.
   - This adds an optional `{ replace }` to `entityLink.openThread`. It is additive, and the names 299-03 and 299-04 consume are unchanged.
4. **No launch or startChat fence was re-targeted.**
   - Without App's `entityLink`, the hook is inert and `openThread` is the pre-299 `selectThread` + `onNavigate("chat")` pair, through a `legacyOpenChat` input.
   - So every suite that mounts ChatLayout alone keeps its assertions. No `D-299-02` re-target was needed.
5. **`navigationKeepsStreams`' new case was green on arrival.**
   - Task 1 already handed `entityLink` to the ChatLayout probe, so the stream-survival property held before Task 2.
   - It is a guard (T-299-21), not a RED.
   - The RED for Task 2 was `useThreadAddress.test.tsx`, which failed with the module missing.

### Auto-fixed issues

1. **[Rule 3] `librarySubtree.fences.test.ts` lives in `library/`, not `library/__tests__/`, as the plan's path said.** The real file was edited.
   - The length pin was amended 18 → 19 under **D-299-02**. The old line is noted in a dated comment.
2. **[Rule 1] F6 scoping control.** The new hook's docblock named the draft's opaque field, which put a fifth module in F6's mention list. The docblock was re-worded and F6 was not touched.
3. **[Rule 1] The acceptance grep `WorkflowsPage` = 0** was tripped by a docblock sentence. It now reads "the page that hosts it".
4. **[Rule 3] Two typecheck findings in the Task 2 GREEN commit.**
   - An unused `entityLink` destructure in AppViewSwitch: it was declared in the props in Task 2 and destructured in Task 3.
   - `vi.fn` typing in `useThreadAddress.test.tsx`.
5. **The WorkflowCard seam286 `.snap` was committed** with exactly five `data-row-id="row-…"` insertions and nothing else.
   - That file was on the do-not-commit list for its line-ending noise. This is a real content change the attribute requires.
   - Precedent: `c30ac9f73` (290-02) updated the same pin in its feat commit.
   - The other five listed `.snap` files and the unrelated dirty files were not staged.

## Known Stubs

None. `linkedDefinitionId`, `openBundleId` and `threadHolding` are all wired to real state.

## Threat Flags

None. T-299-18..22 are mitigated as planned:
- **T-299-18:** strict UUID per variant, the HOSTILE set, entity id-shape cases, and `go` refusing a non-UUID id.
- **T-299-19:** the auto-mocked API module with every function asserted uncalled.
- **T-299-20:** opens only from server-narrowed lists, plus the grant-aware `getExpert`.
- **T-299-21:** `navigationKeepsStreams`, with StreamsProvider unedited.
- **T-299-22:** exact PUSH counts by location key under StrictMode.

## Not flipped (by instruction)

SEED-178 and SEED-015 flip at phase close, after G-4. STATE.md and ROADMAP.md were not modified, and no `gsd-sdk query state.*` verb was called.

## TDD Gate Compliance

Each task has a `test(299-02)` RED commit before its GREEN commit:
- `3bb1fe71a` → `f92cdaedd`: 45 failures — the new entity cases, plus the ENTITY formatting case.
- `a832b65fb` → `fed2dbedd`: the module was missing.
- `bf7283e9c` → `153851d46`: the hook module was missing; 9 failures in the link suite; the subtree list was short by one.

## Self-Check: PASSED

- All 6 created files exist on disk.
- All 6 task commits exist on `develop` (`git log a25fea958..HEAD`): 3bb1fe71a, f92cdaedd, a832b65fb, fed2dbedd, bf7283e9c, 153851d46.
- `git diff --name-only a25fea958 HEAD -- .planning/STATE.md .planning/ROADMAP.md frontend/src/providers/StreamsProvider.tsx` is empty.
