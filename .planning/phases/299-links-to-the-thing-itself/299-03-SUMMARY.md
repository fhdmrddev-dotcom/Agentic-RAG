---
phase: 299-links-to-the-thing-itself
plan: 03
subsystem: frontend / link gate, can't-be-opened card, switch-org prompt
tags: [frontend, links, gate, cant-be-opened, switch-org]
requires:
  - 299-01
  - 299-02
  - 299-05
provides:
  - "lib/clipboard.ts: copyText(text) → 'copied' | 'refused' (never throws), selectAllIn(el), copyShortcutWord()"
  - "lib/api/links.ts: resolveLink(kind, id) → {status:'ok', target} | {status:'cant'}; any other failure throws ApiError; LinkKind, LinkTarget, LinkAnswer (re-exported from lib/api.ts)"
  - "layout/CantBeOpened.tsx: CantBeOpened({kind, route, onGo, children?}), CANT_BE_OPENED_COPY, ADDRESS_NOT_FOUND_COPY (moved; AddressNotFound.tsx re-exports it)"
  - "layout/LinkGate.tsx: LinkGate render-prop gate, GateState (none | holding | cant | prompt | open, each with notice), HOLDING_SENTENCE"
  - "layout/SwitchOrgPrompt.tsx: SwitchOrgPrompt + SwitchOrgPromptProps"
  - "EntityLink gains address, leave(route?), openRoute(route), resume()"
  - "orgItemsCopy.ts: thisIsIn, workingIn, KEEPS_GOING_TAIL, KIND_CAPTION, stayIn, switchingTo, stillAnsweringOne/Many, BACK_TO_IT, stayedIn, OPEN_IT_AFTER_ALL, yourChatInStill, SWITCH_BACK, THIS_ORG"
  - "AppViewSwitch prop threadsPending (optional)"
affects: [299-04]
tech-stack:
  added: []
  patterns:
    - "a hook-free switch gets state through a render-prop component (LinkGate) rather than hooks"
    - "answer cache in a ref Map keyed kind:id, StrictMode-safe in-flight set, retry timer keyed to the wanted key"
    - "snapshot-before-side-effect (streamingThreads read before switchOrg)"
    - "adjust-state-during-render for notices that end at the next navigation"
key-files:
  created:
    - frontend/src/lib/clipboard.ts
    - frontend/src/lib/__tests__/clipboard.test.ts
    - frontend/src/lib/api/links.ts
    - frontend/src/lib/api/__tests__/links.test.ts
    - frontend/src/components/layout/CantBeOpened.tsx
    - frontend/src/components/layout/__tests__/CantBeOpened.test.tsx
    - frontend/src/components/layout/LinkGate.tsx
    - frontend/src/components/layout/__tests__/LinkGate.test.tsx
    - frontend/src/components/layout/SwitchOrgPrompt.tsx
    - frontend/src/components/layout/__tests__/SwitchOrgPrompt.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/lib/__tests__/apiBarrel.test.ts
    - frontend/src/components/layout/AddressNotFound.tsx
    - frontend/src/components/layout/AppViewSwitch.tsx
    - frontend/src/components/layout/__tests__/AppViewSwitch.addressStates.test.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/hooks/useAppNavigation.ts
    - frontend/src/hooks/__tests__/useAppNavigation.test.tsx
    - frontend/src/components/org/orgItemsCopy.ts
    - frontend/src/__tests__/routing/navigationKeepsStreams.test.tsx
    - frontend/src/components/experts/catalog/__tests__/ExpertCatalogPage.link.test.tsx
    - frontend/src/hooks/__tests__/useThreadAddress.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "The gate's exits and 'Open it after all' go through a new entityLink.openRoute (a push). onNavigate('chat') is a no-op on a chat address since 299-02, so 'Go to Chat' on a refused thread link could not have used it"
  - "ChatLayout passes threadsPending to AppViewSwitch (one prop line beside the one-token guard change): the gate must hold a thread address until the active org's list answers, and threadHolding cannot tell 'pending' from 'absent'"
  - "The chat <main> gets an always-present flex column (notice slot + min-h-0 flex-1 body), so ChatArea is never remounted when a notice appears and the min-h-0 chain still bounds it"
  - "HOLDING_SENTENCE.run is a getter over COPY_LOADING, so the suites that stub the run page's module without the constant still import the gate"
  - "THIS_ORG ('this organization') stands in for an org name that has not answered yet, so no sentence renders an empty name"
  - "'Back to it' also shows the Stay notice (UI-SPEC: Back to it = Stay, landing on that chat)"
  - "The resolve cache lives for the gate's life, keyed kind:id. After a Switch the cached answer matches the new org with no second request"
metrics:
  duration: "~1h05m"
  completed: 2026-10-28
  tasks: 3
  commits: 6
---

# Phase 299 Plan 03: One gate in front of every link — Summary

Every entity address now passes through one gate before its page opens. The gate asks the server
once, then does one of four things:

- **holds**, with "Opening the …";
- **opens** the item;
- shows **one in-place card**, "This … can't be opened" — the same for a made-up id and for someone else's real id;
- asks **"This is in <org> — switch?"**.

**Stay** changes nothing, and a live answer keeps streaming. **Switch** opens the item and says the
other chat is still answering. A sign-in return target is resumed once. 297's unparseable-address
page is now the card's no-address variant.

## What was built

**Task 1 — the client, the clipboard leaf and the card** (`89cda59a9` RED, `f1fb8f718` GREEN)
- `lib/clipboard.ts` (40 lines) is FilePreview's copy idiom, extracted. A missing API, a rejected write and a synchronous throw all answer `refused`.
- `lib/api/links.ts` (46 lines): a 404 answers `cant`. A 5xx, 401, 403 or a network error throws `ApiError` (T-299-25).
- `lib/api.ts` gets one `// ── links (Phase 299-03) ──` block beside the orgItems block.
- `CantBeOpened.tsx` (159 lines) uses the S1 tokens:
  - The area behind it is `inert` and `aria-hidden`.
  - The heading is focused once on mount, inside a `<section aria-labelledby>`, never an alert.
  - The address is `window.location.host + formatAppRoute(route)` (D-36). There is no path prop and no icon.
  - Copy address shows "✓ Address copied" for 2 s and announces it through an sr-only status. On refusal it selects the address and shows "Press Ctrl+C / ⌘C to copy".
  - The heading id is a constant, so two renders of one answer are byte-identical.
- `AddressNotFound.tsx` now renders `<CantBeOpened kind={null} route={null} …/>`. It re-exports `ADDRESS_NOT_FOUND_COPY`. `ADMIN_HOLD_COPY` and `AddressHolding` stay where they were.

**Task 2 — the gate** (`3be8451ef` RED, `a447389fe` GREEN)
- `LinkGate.tsx` holds the decision table in its docblock:
  - A thread in the active org's list opens with no server call.
  - Otherwise it makes one `resolveLink` per kind:id and caches the answer.
  - A same-org thread missing from the list triggers `loadThreads()` once, then opens and selects it, or shows the card.
  - A throw retries at 2 s, 4 s, 8 s, then every 8 s, and stops when the address changes.
  - `entityLink.resume()` runs once on mount.
- `AppViewSwitch.tsx` (still no hook) wraps its body in one `<LinkGate>{(gate) => …}</LinkGate>`:
  - A refused or prompting thread renders on the non-chat side, so the main region behind the card is empty.
  - S1 stays the first non-chat arm. Then come `cant` (the card over the generic area), `holding` and `prompt`.
  - The generic area is `WorkflowsPage` with no linked id for a workflow or a run (never `WorkflowRunPage`), `ExpertCatalogPage` with no open id for an Expert, and nothing for a chat.
- `useAppNavigation.ts`: `entityLink` gains:
  - `address`;
  - `leave(route?)`: a REPLACE to the given route, else the last non-entity place, else `/app`;
  - `openRoute` (a push);
  - `resume()`: `takeReturnTarget()`, which replaces only on `/` or `/app`.
- `ChatLayout.tsx`: the history-column guard drops `&& !addressNotFound`, and `threadsPending` is passed through.

**Task 3 — the switch prompt** (`679c7a7a7` RED, `034124bef` GREEN)
- `SwitchOrgPrompt.tsx` (124 lines) is S3:
  - The target org's avatar initial.
  - "This is in {Org}" and the body. The keeps-going tail appears only while a chat in the active org is answering.
  - The item box: a kind caption, uppercase by CSS, and the title as React text.
  - Stay (outline) and Switch, the only filled button. While switching, a "Switching to {Org}…" status replaces them.
  - The still-answering chip, with "Back to it".
  - It never calls `switchOrg`.
- `LinkGate`:
  - **Stay** and **Back to it** call `leave` (a REPLACE) and set the stayed notice. "Open it after all" pushes the link back.
  - **Switch** reads `useStreamsStore.getState().streamingThreads` before calling `switchOrg(target.org_id)`, once.
  - **Switch back** calls `switchOrg(previous)` and then `openThread`.
  - Both bars are returned as `gate.notice`.
- `AppViewSwitch` renders the prompt arm, and renders `gate.notice` at the top of each region:
  - Non-chat side: between the mobile bar and `<main>`.
  - Chat side: inside an always-present `flex h-full min-h-0 flex-col` › `min-h-0 flex-1` column.
- `orgItemsCopy.ts` gets the S3 words and is still a strict leaf.

## Gate results

- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, repo root), verbatim: `count gate OK — 561/561 pinned files present, no per-file decrease, 0 failing.`
  - Totals: `total 13091 · failed 0 · pinned total 11942`.
  - Per-file deltas for this plan's suites are all 0:

  | Suite | Pinned = actual |
  |---|---|
  | useAppNavigation | 72 (was 63) |
  | LinkGate | 41 (new) |
  | AppViewSwitch.addressStates | 30 (was 19) |
  | useThreadAddress | 21 (unchanged) |
  | CantBeOpened | 18 (new) |
  | SwitchOrgPrompt | 15 (new) |
  | ExpertCatalogPage.link | 11 (unchanged) |
  | links | 9 (new) |
  | clipboard | 8 (new) |
  | apiBarrel | 6 (was 5) |
  | navigationKeepsStreams | 5 (was 4) |

- **Typecheck set-diff** (`npx tsc -p tsconfig.app.json --noEmit`): base `1fd751ab0` has 61 errors. After each task the count is still 61, with **new 0, gone 0**.
  - Task 2 briefly added 1 (TS2739, the `useThreadAddress.test.tsx` fake missing the new EntityLink members). It was fixed in the same commit.
- **Ledger gate:** `ledger gate OK — every watched file has a row.`
- **CLAUDE.md size gate:** `claude-md size gate OK` (103,007 chars). Every new CLAUDE.md cell is ≤ 80 chars.
- **Targeted suites:** the final broad run passed 234 files under `src/components/layout`, `src/hooks`, `src/__tests__`, `src/components/experts`, `src/components/org`, `src/lib`, `src/pages/__tests__` and `src/components/workflows/library`.
- **Planted defect:** moving the `streamingThreads` read after `switchOrg` turns 3 LinkGate cases red (call order, the after-switch line, and its clearing). The code was restored md5-identical (`710325ce…`).
- **Acceptance greps:**

  | Check | Result |
  |---|---|
  | `If someone sent you this link…` in the card | 1 |
  | Reason words in the card (raw) | 0 |
  | `formatAppRoute(` in the card | 2 |
  | `ADDRESS_NOT_FOUND_COPY` in AddressNotFound | 1 |
  | `<LinkGate` in AppViewSwitch | 1 |
  | React hooks in AppViewSwitch (raw) | 0 |
  | `resolveLink(` in the gate | 1 |
  | `useLocation\|useNavigate` in the gate | 0 |
  | `!addressNotFound && !historyCollapsed` in ChatLayout | 0 |
  | `switchOrg(` in SwitchOrgPrompt | 0 |
  | `switchOrg(` in LinkGate | 2 |
  | `git diff 1fd751ab0 -- StreamsProvider.tsx streamsStore.ts NavPanel.tsx` | empty |

  - ⚠ `grep -c "import" orgItemsCopy.ts` reads **3**. That count was already non-zero at base: it matches the docblock words "no imports", "imports it from here" and "imports nothing". There are **0** import statements, and `SwitchOrgPrompt.test.tsx` asserts that.
- `setViewingThread` still has its one writer, because ChatArea is untouched.

## Known UI deviation for the operator (surfaced to the verifier, not fixed here)

**The rail highlight for a run link.** UI-SPEC S1's table says the rail highlights **Workflows** behind a run's card. This plan does not do that:
- `NavPanel.tsx` was not edited. It is FIRING at 26/14, and the instruction was to leave it alone.
- No rail item claims `workflow-run`. So while a refused, holding or prompting run link is on screen, the rail reads as it does in the run room today: nothing is current.
- The workflow and Expert kinds highlight correctly, because their views are `workflows` and `experts`.

This needs an operator decision: accept it, or make it a one-line follow-up in NavPanel.

## Deviations from Plan

### Reasoned deviations

1. **ChatLayout changes in two places, not one token.** The guard token was dropped as planned. I also added one pass-through prop line, `threadsPending={threadsPending}`. AppViewSwitch did not receive that value, and the gate has to hold a thread address until the list answers. The `threadHolding` flag cannot tell "pending" from "absent". No useState or useEffect was added, and the IN-01 effect was not edited.
2. **The exits use a new `entityLink.openRoute`, not `onNavigate(viewForKind)`.** Since 299-02, `onNavigate("chat")` is a no-op on a chat address. So "Go to Chat" on a refused `/app/chat/<id>` would have done nothing. `openRoute` is a push, which keeps D-15: Back returns to the card. The unparseable variant still calls `onNavigate("chat")`, as in 297.
3. **The chat `<main>` gets an always-present flex column for `gate.notice`.**
   - Putting the bar as a plain first child of the block-level, `overflow-hidden` main would clip the bottom of ChatArea, the composer, by the bar's height.
   - Adding a wrapper only while a notice shows would remount ChatArea.
   - The main's class string is unchanged, so the scroll-frame fence stays green.
   - ⚠ jsdom cannot measure layout. The min-h-0 chain through the two new divs is owed to the G-4 browser drive (the 244-01 precedent).
4. **The prompt arm renders the gate's props (`<SwitchOrgPrompt {...gate.prompt} />`).** It does not take a separately wired `<SwitchOrgPrompt …/>`. The handlers live in LinkGate, so the snapshot-before-switch rule has one home.
5. **`THIS_ORG` was added to orgItemsCopy** as the fallback for an org name that has not answered yet.
6. **"Back to it" also shows the Stay notice.** UI-SPEC defines it as Stay, landing on that chat.

### Auto-fixed issues

1. **[Rule 3] `HOLDING_SENTENCE.run` is a getter.** Four layout suites stub `@/pages/WorkflowRunPage` without `COPY_LOADING`. An eager read at module load failed their import. They never hold a run.
2. **[Rule 3] 299-02 test fakes.** `ExpertCatalogPage.link.test.tsx` and `useThreadAddress.test.tsx` build `EntityLink` fakes, and those fakes gained the four new members.
   - The ExpertCatalogPage wire cases were **re-targeted under D-12**, with the reason in each test body. The gate now answers before the page gets its id, so the assertion waits for it, and a thread target now shows the chat card. The property under test is unchanged: no Expert opens and no `getExpert` call is made.
   - Neither file was in the plan's list.
3. **[Rule 1] Two harness bugs in my own RED tests**, fixed in the GREEN commit:
   - `beforeEach(() => mock.mockReset())` returned the mock, and vitest ran it as a teardown that hung. It now uses a block body.
   - The thread-reload case resolved `loadThreads` before the list re-rendered, which the real hook never does. It now uses a deferred promise.
4. **[Rule 1] Defensive `org?.orgs ?? []`.** `ChatLayout.orgRefetch.test.tsx` mocks the org context without `orgs`, so the gate crashed reading `.find`.
5. **297 fence re-targeted, not deleted:** `AppViewSwitch.addressStates` "hides the chat history column" is now "D-14: keeps the chat history column live behind the card". It keeps the same positive control and the same rail assertion, with the reason in its body. No S1 word changed, so the other 297 S1 cases stayed green unedited.

## Known Stubs

None. Every gate state is wired to the real resolver, the real org context and the real streams store.

## Threat Flags

None beyond the register. Each threat and how it is mitigated:

- **T-299-23:** one `cant` for missing and forbidden, plus identical-DOM cases in the card, the gate and the layout.
- **T-299-24:** only `formatAppRoute(parsed)` is displayed. There is no path prop, and that is source-fenced.
- **T-299-25:** a throw holds and retries, and is never the card.
- **T-299-26:** `switchOrg` is called only from Switch and Switch back, with no call on render (tested).
- **T-299-27:** Stay leaves the org and the subscription untouched, tested four-axis in `navigationKeepsStreams`.
- **T-299-28:** titles and org names are React text, with no `dangerouslySetInnerHTML` (source-scanned).
- **T-299-29:** resume consumes once and replaces only on `/` or `/app`. `returnTo` re-validates the stored value.

## TDD Gate Compliance

Each task has a `test(299-03)` RED commit before its `feat(299-03)` GREEN commit:
- `89cda59a9` → `f1fb8f718`: 4 files failed on the missing modules.
- `3be8451ef` → `a447389fe`: 3 files failed; LinkGate was missing, and there were 9 useAppNavigation and 11 addressStates failures.
- `679c7a7a7` → `034124bef`: 3 files failed on the missing `SwitchOrgPrompt`.

## Not done here (by instruction)

STATE.md and ROADMAP.md were not modified, no `gsd-sdk query state.*` verb was called, and `graphify update .` was not run. The dirty `.snap` files and the other unrelated dirty files were not staged. None of this plan's changes altered a snapshot.

## Self-Check: PASSED

- All 10 created files exist on disk.
- All 6 task commits exist on `develop` (`git log 1fd751ab0..HEAD`): 89cda59a9, f1fb8f718, 3be8451ef, a447389fe, 679c7a7a7, 034124bef.
- `git diff --name-only 1fd751ab0 HEAD -- .planning/STATE.md .planning/ROADMAP.md frontend/src/providers/StreamsProvider.tsx frontend/src/stores/streamsStore.ts frontend/src/components/layout/NavPanel.tsx` is empty.
