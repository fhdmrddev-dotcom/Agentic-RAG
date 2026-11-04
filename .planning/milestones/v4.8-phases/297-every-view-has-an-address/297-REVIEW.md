---
phase: 297-every-view-has-an-address
reviewed: 2026-10-27T20:40:22Z
depth: standard
files_reviewed: 46
files_reviewed_list:
  - .github/workflows/frontend-tests.yml
  - frontend/package.json
  - frontend/src/main.tsx
  - frontend/src/App.tsx
  - frontend/src/lib/appRoutes.ts
  - frontend/src/lib/leaveGuard.ts
  - frontend/src/lib/runDeepLink.ts
  - frontend/src/lib/activeViewReachability.ts
  - frontend/src/hooks/useAppNavigation.ts
  - frontend/src/components/layout/AppViewSwitch.tsx
  - frontend/src/components/layout/AddressNotFound.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/panel/WorkspacePanel.tsx
  - frontend/src/components/settings/ConnectionsTab.tsx
  - frontend/src/components/workflows/RunEvidenceReport.tsx
  - frontend/src/pages/WorkflowRunPage.tsx
  - frontend/src/pages/WorkflowsPage.tsx
  - frontend/src/__tests__/routing/appRouteParity.test.ts
  - frontend/src/__tests__/routing/routingLayers.testutil.ts
  - frontend/src/__tests__/routing/navigationKeepsStreams.test.tsx
  - frontend/src/__tests__/routing/noRawHistoryWrites.test.ts
  - frontend/src/hooks/__tests__/useAppNavigation.test.tsx
  - frontend/src/hooks/__tests__/useAppNavigation.leaveGuard.test.tsx
  - frontend/src/pages/__tests__/WorkflowsPage.leaveGuard.test.tsx
  - frontend/src/components/layout/__tests__/AppViewSwitch.addressStates.test.tsx
  - frontend/src/lib/__tests__/appRoutes.test.ts
  - frontend/src/lib/runDeepLink.test.ts
  - frontend/src/docs/__tests__/docsVercelRouting.test.ts
  - frontend/src/pages/__tests__/SetupWizard.test.tsx
  - frontend/src/components/workflows/__tests__/RunOriginLine.test.tsx
  - frontend/src/components/layout/__tests__/ChatLayout.runDeepLink.test.tsx
  - frontend/src/components/layout/__tests__/ChatLayoutLaunch.test.tsx
  - frontend/src/components/layout/__tests__/ChatLayout.fallback.test.tsx
  - frontend/src/components/layout/__tests__/ChatLayout.scrollFrame.test.tsx
  - frontend/src/components/layout/ChatLayout.launch.test.tsx
  - frontend/src/components/chat/__tests__/ChatArea.expertThread.test.tsx
  - frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx
  - frontend/src/pages/__tests__/LibraryPage.tabAttention.test.tsx
  - frontend/src/lib/__tests__/activeViewReachability.test.ts
  - frontend/src/__tests__/library/renameFence.test.ts
  - frontend/src/hooks/useOperatorProbe.ts (read for cross-file trace; not changed)
  - frontend/src/hooks/useEffectiveFeatures.ts (read for cross-file trace; not changed)
  - frontend/src/pages/WorkflowBuilderPage.tsx (read for cross-file trace; not changed)
  - frontend/src/lib/supabase.ts (read for cross-file trace; not changed)
  - frontend/node_modules/react-router/dist/development/lib/router/router.js (read: POP blocker path)
  - frontend/node_modules/@supabase/auth-js/dist/module/GoTrueClient.js (read: implicit-flow hash clear)
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 297: Code Review Report

**Reviewed:** 2026-10-27T20:40:22Z
**Depth:** standard (plus targeted cross-file traces into react-router 8.5.0 and supabase auth-js)
**Files Reviewed:** 46
**Status:** issues_found

## Summary

I went through the router core (`main.tsx`, `useAppNavigation.ts`, `appRoutes.ts`), the leave guard
(`leaveGuard.ts`, the `WorkflowsPage.tsx` tenant wiring), the switch extraction
(`AppViewSwitch.tsx`, `ChatLayout.tsx`, `AddressNotFound.tsx`), the `?run=` retirement, and the
re-targeted and new test suites.

What holds up, checked by reading each code path end to end:

- **Streams never remount (focus 1).** There is one `path: "*"` route created at module scope, with
  no children, no outlet and no key. Every address matches the same route id, so `<App/>`,
  `OrgProvider` and `StreamsProvider` stay mounted across navigations. The
  `LeaveGuardContext.Provider` value has one identity for the hook's lifetime.
  `navigationKeepsStreams.test.tsx` runs the real provider stack and asserts a real abort signal
  and a mount counter. It is not vacuous.
- **No navigation loops (focus 2).** `canonicalAddress` gives `null` for every canonical,
  pre-auth, bare-`/` and not-found input, so the replace effect settles after one step. Only
  `formatAppRoute`'s output plus the leftover query is ever written, and the result is checked to
  start with `/app`. `go()` skips a navigation when the target address is already on screen.
- **Pre-auth flows (focus 4).** `/setup` and `/invite` exactly match `PRE_AUTH_PATHS`, are never
  rewritten, and App's raw `window.location.pathname` checks are unchanged. The OAuth
  `?connections=1&…` handling drops the query exactly as the old initializer did. Nothing in the
  tree reads `oauth_error`, which I confirmed by grep.
- **URL parsing (focus 5).** Ids are strict UUIDs and lowercased. Paths containing `//`, `\`, `%`,
  an empty segment or a dot never reach the table. The parser is total. I found no open-redirect
  path.
- **`useBlocker` asks once per attempt (focus 3).** For memory and browser history entries the
  router created, it asks once and resets on Cancel; `react-router/.../router.js:239-277`
  confirms this. The StrictMode exact-count suites are real.

The defects are at the edges of the leave guard and in the timing of the address-state holds:

- The guard can show its prompt and then ignore Cancel on one specific History entry that the auth
  library writes (WR-01, reproduced below).
- The one-shot latch can stay armed across a person-paced await (WR-02).
- The admin and run holds flash a refusal or fallback for one frame after sign-in (WR-03).
- A cancelled navigation leaves the side effects it had already run (WR-04).

## Warnings

### WR-01: The leave prompt is shown, Cancel is pressed, and the edit is discarded anyway — on the History entry supabase-js's implicit-flow callback writes

**File:** `frontend/src/hooks/useAppNavigation.ts:146-158` (with `frontend/src/lib/supabase.ts:36-39`, `@supabase/auth-js/dist/module/GoTrueClient.js:1706`, `react-router/dist/development/lib/router/router.js:245-252`)

**Issue:** The Supabase client is created with default options (`createClient(url, key)`), and the
default flow is implicit (`flowType: 'implicit'`, `detectSessionInUrl: true`). Every SSO login
(Phase 168), email-confirmation link and magic link therefore lands with
`#access_token=…`. Auth-js then clears the hash with `window.location.hash = ''`. That is a
same-document fragment navigation, so it pushes a new History entry with `history.state === null`.

`noRawHistoryWrites.test.ts` fences only product code, so it cannot see this write.

Here is how the router handles a POP onto that entry, per `router.js:245-252` and `history.js:285-289`:

- `delta` is `null`.
- `shouldBlockNavigation` is still called.
- Under wiring (A), that call runs the tenant's `window.confirm(UNSAVED_LEAVE_PROMPT)`.
- The block itself is skipped (`if (blockerKey && delta != null)`), and `startNavigation`
  proceeds.

**Reproduced** in node with jsdom and the installed react-router 8.5.0 (script in the session
scratchpad: hash set, then cleared, then `router.navigate("/app/workflows")`, a blocker that answers
"Cancel", then `history.back()`). The output was `asked 1 | router pathname / | blocker (none)`,
and the router printed its own warning: *"You are trying to use a blocker on a POP navigation to a
location that was not created by @remix-run/router. This will fail silently in production."*

**Failure scenario:** An SSO user signs in and lands on chat. They open Workflows, and a Builder
save is refused, so the Builder is dirty (the only state in which the prompt exists, per 186-07).
They press browser Back. The prompt appears, they press Cancel, and they still leave: the Builder
unmounts and the edits are gone. Under LINK-07 this is worse than no prompt, because the app told
them the edit would be kept.

**Fix:** Remove the null-state entry at its source by switching the auth client to PKCE. Auth-js's
PKCE branch clears `?code=` with `history.replaceState(window.history.state, …)`, which keeps the
router's `idx`. A replace through the router cannot repair the entry, because `replace()` re-reads
the null `idx`.

```ts
// frontend/src/lib/supabase.ts — both createClient calls
createClient(url, key, { auth: { flowType: "pkce" } })
```

This change touches the SSO/redirect configuration, so it needs its own UAT. If PKCE cannot ship in
this phase, at minimum stop asking a question the router cannot honour. In `shouldBlock`, when
`historyAction === "POP"` and `window.history.state?.idx == null`, return `false` without calling
the predicate. Also add a browser-router test that plants a raw hash write, so the case is fenced.

### WR-02: Test Run arms the one-shot latch across a person-paced await, so a Back during the launch form skips the prompt

**File:** `frontend/src/pages/WorkflowsPage.tsx:966-986` (with `frontend/src/components/layout/ChatLayout.tsx:393-405`, `frontend/src/pages/WorkflowBuilderPage.tsx:1236-1249`)

**Issue:** `onTestRun` calls `leaveGuards.approveNextLeave()` before `await onLaunch(…)`, and
`onLaunch` is `doRun`. For a definition with declared inputs, `doRun` first awaits a promise that
resolves only when the person submits or cancels the launch form (`setLaunchAsk`). That form is
mounted outside the view split, so it survives a navigation. Then come `createThread`, the upload
and `postMessage`, all network-bound.

For that whole window the latch is armed. Any pathname change that happens before `doRun`'s own
`openRun` consumes it in `canLeaveAll()` and leaves without asking. Browser Back and rail clicks
both qualify. The phase's own claim is that "a latch can never sit armed and silently skip a later
prompt" (leaveGuard.ts:16-20, T-297-13). The `finally` clear and the `location.key` clear both run
too late to stop this.

The Builder can be dirty here. `handleTestRun` ignores `saveNow()`'s boolean, so a refused save
still proceeds to `onTestRun` with `dirty === true`.

**Failure scenario:** A save is refused, so the Builder is dirty. The person clicks Test Run, the
launch form opens, and they press browser Back meaning "never mind". There is no prompt, the
Builder unmounts, and the unsaved edits are lost. `WorkflowsPage.leaveGuard.test.tsx` covers only
the cases where Test Run completes and where the launch does not navigate. No test covers a
navigation during the await.

**Fix:** Arm the latch at the moment of the launch's own navigation, not before the await. For
example, let the launch take an option that arms it right before the navigation:

```ts
// ChatLayout doRun tail
if (workflowRunId) { opts?.beforeNavigate?.(); openRun?.(workflowRunId); return }
opts?.beforeNavigate?.(); selectThread(thread); onNavigate("chat")
// WorkflowsPage onTestRun
await onLaunch(def, "", { beforeNavigate: () => leaveGuards.approveNextLeave() })
```

Separately, `handleTestRun` should not launch when `saveNow()` returns `false`.

### WR-03: After sign-in, a cold `/app/admin` or `/app/runs/<id>` paints the refusal or the dev fallback for one frame before the hold (D-19 / D-35)

**File:** `frontend/src/components/layout/AppViewSwitch.tsx:374-380, 390-445, 448-454` (with `frontend/src/hooks/useOperatorProbe.ts:43-66`, `frontend/src/hooks/useEffectiveFeatures.ts:41-66`, `frontend/src/App.tsx:172,179`)

**Issue:** Both probes start with `loading = true`. But while App is signed out they run with
`userId === null`, and their effect immediately sets `loading` to `false`.

When the session arrives (`setUser` from `onAuthStateChange` after `signIn`, or a slow token
refresh that resolves after the setup probe), App renders ChatLayout in the same pass. At that
point the probes still report `loading === false` with `isOperator === false` and an empty
features map. They flip `loading` back to `true` only in their passive effects, after that commit
has painted.

So for one frame:

- The `control-room` and `admin-spend` arms render `AddressNotFound` ("This address doesn't open
  anything").
- The `workflow-run` arm's condition `(canvasEnabled || featuresLoading)` is `false`, so it falls
  to `<UnknownViewFallback>` ("This view has no screen: workflow-run").

D-19 says a cold run address shows "never a fallback flash", and D-35 says "holding state until
then". `AppViewSwitch.addressStates.test.tsx` sets the props directly, so it cannot see this
cross-hook timing.

**Failure scenario:** A signed-out operator opens a shared `/app/runs/<id>` link and signs in on
AuthPage. They briefly see "This view has no screen: workflow-run", then "Opening the run…", then
the run. The same happens with `/app/admin` and S1.

**Fix:** Make the probes report loading until they have answered for the user they were called
with:

```ts
const [probedFor, setProbedFor] = useState<string | null | undefined>(undefined)
// set setProbedFor(userId) in the .finally / the !userId branch
return { ..., loading: loading || probedFor !== userId }
```

The same pattern applies in `useEffectiveFeatures`. Add an App-level test that flips `useAuth`
from signed-out to signed-in at `/app/admin` and asserts that S1 is never rendered.

### WR-04: A navigation the leave guard cancels still applies the side effects its navigator ran first (stale Library Health hand-off)

**File:** `frontend/src/hooks/useAppNavigation.ts:178-181, 220-223, 242-246`

**Issue:** `handleOpenLibraryHealth` calls `setLibraryTab("health")` before `go(...)`, and
`handleOpenStudio` calls `setStudioTab(tab)` before `go(...)`. When the blocker cancels the push,
`activeView` never changes. The spend rule at :242-246 runs only on a view change, so the pending
`"health"` hand-off is never spent. The next plain entry into the Library, for example from the
rail, re-seeds `LibraryPage` from `initialTab="health"`. That is the exact defect 235-15 closed
("every subsequent entry into the Library opened on Health"), reopened by Cancel. The same
ordering also leaves a changed `studioTab`, and NavPanel's thread pick (`selectThread` before
`onNavigate("chat")`) switches the viewed thread behind a cancelled leave.

**Failure scenario:** The Builder is dirty. The person clicks the rail's attention popover, then
Health, presses Cancel, and saves. Later they click Library in the rail and land on the Health tab
instead of the Library's default.

**Fix:** Clear the hand-off when the blocker cancels, in the existing reset effect:

```ts
useEffect(() => {
  if (blocker.state !== "blocked") return
  here.current = `${location.pathname}${location.search}`
  setLibraryTab((pending) => libraryTabAfterNavigate(pending, activeView))
  blocker.reset()
}, [blocker, location.pathname, location.search, activeView])
```

This adds a third `setLibraryTab(` writer, so update the two-writer pin in
`LibraryPage.tabAttention.test.tsx` under a `D-297-NN` id. The alternative is to have the
navigators commit their state only after the navigation lands.

## Info

### IN-01: `formatAppRoute` does not validate the ids it is handed

**File:** `frontend/src/lib/appRoutes.ts:71-75`
**Issue:** The parser enforces strict UUIDs, but the formatter interpolates `runId` and `skillId`
verbatim. `openRun("not-a-uuid")` or a `run_id` from the wrong table pushes an address that parses
to not-found, so the person lands on S1. Every current id comes from the server and is a UUID, and
there is no off-origin risk: cross-origin `pushState` throws. Still, the table's guarantee is only
one-sided.
**Fix:** In `go()`, refuse a non-UUID id: `if (route.view === "workflow-run" && !isStrictUuid(route.runId)) return`.

### IN-02: Clicking Chat at bare `/` pushes a duplicate entry for the same view

**File:** `frontend/src/hooks/useAppNavigation.ts:121-129`
**Issue:** `/` is deliberately not normalised (D-13). `go({view:"chat"})` compares `"/app"` with
`"/"`, finds them different, and pushes `/app`. Back then returns to `/`, which shows the same chat
view. This breaks the D-15 rule that the view already on screen is a no-op. The same thing happens
at `/app?code=…`. `bounceHome` from `/` likewise rewrites the clean root that SEED-242 keeps on
`app.*`.
**Fix:** In `go`, also skip when `parseAppLocation(here)` already equals the target route.

### IN-03: "is left exactly as it is" has no positive control for its single flush

**File:** `frontend/src/hooks/__tests__/useAppNavigation.test.tsx:278-284` (also `:94-99`, `:294-300`)
**Issue:** The negative assertions run after one `await act(async () => {})`. Every positive
normalisation case uses `waitFor`. Nothing proves that one `act` flush is enough for a replace to
land, so a slower router could make these pass vacuously.
**Fix:** Add a control in the same shape. Mount `/workflows`, run the same single
`await act(async () => {})`, and assert that it *was* replaced.

### IN-04: The no-key fence omits the new provider

**File:** `frontend/src/__tests__/routing/navigationKeepsStreams.test.tsx:226`
**Issue:** The `key=` alternation lists seven components but not `LeaveGuardContext.Provider`. That
provider was added this phase and wraps ChatLayout.
**Fix:** Add `LeaveGuardContext\.Provider` to the alternation.

### IN-05: The react-router range is caret after a provenance gate pinned 8.5.0

**File:** `frontend/package.json:51`
**Issue:** D-39 ran a provenance check against exactly `react-router@8.5.0`, but `"^8.5.0"` lets
any later `npm install` that rewrites the lock pull 8.x without that check.
**Fix:** Pin `"react-router": "8.5.0"`. The project already pins `mediabunny` and `minisearch`
exactly.

### IN-06: "Try in Chat" is a visible menu item that does nothing

**File:** `frontend/src/components/settings/ConnectionsTab.tsx:1143-1149`
**Issue:** This was inert before as well (D-37, SEED-392). It is now explicitly a control with no
handler that people can still click.
**Fix:** Hide the item until SEED-392 wires it, or render it `disabled`.

---

_Reviewed: 2026-10-27T20:40:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
