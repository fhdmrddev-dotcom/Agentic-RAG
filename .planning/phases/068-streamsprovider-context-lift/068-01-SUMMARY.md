---
phase: 068-streamsprovider-context-lift
plan: 01
subsystem: frontend
tags: [react, zustand, react-provider, refactor-scaffold, frontend-state, sse, streams]

# Dependency graph
requires:
  - phase: 067.3-per-thread-message-buffers
    provides: per-thread bucket pattern (Map<threadId, Message[]>) + Branch D-3 guard predicate (useMessages.ts:589-598) + ref-based reconcile listener (ChatArea.tsx:162-187)
  - phase: 067.4-frontend-uat-fixes
    provides: L-068-01 / L-068-02 / L-068-03 invariants discovered during UAT, now formalized as Plan 068-01 acceptance criteria
provides:
  - "Zustand v5 store (`useStreamsStore`) seeded with `bucketsBySurface: Map<SurfaceId, Map<threadId, Message[]>>` + `subscriptionsByRunId: Set<string>` mirror"
  - "`<StreamsProvider>` component holding 5 provider-scoped refs (subscriptionsRef, lastSeenOffsetRef, reconcileInFlightRef, streamingThreadIdRef, activeThreadIdRef)"
  - "4 named hooks (useThreadMessages, useViewingThread, useStreamActions, useStreamSubscriptions) for consumer access — useStreamsStore is implementation detail"
  - "L-068-01 Branch D-3 guard predicate lifted verbatim into clearThreadBucket action (refuses to wipe streaming bucket)"
  - "L-068-02 reconcile in-flight lock shell — coexists safely with ChatArea.tsx legacy listeners pre-Plan-3"
  - "L-068-03 sole-writer pattern enforced: exactly one `activeThreadIdRef.current = ...` expression in StreamsProvider.tsx (inside setViewingThread)"
  - "Reconcile listeners (visibilitychange / focus / pageshow) attached in provider, gated on activeThreadIdRef per D-068-08"
  - "Provider mounted below auth gate in App.tsx — only authenticated users get a store"
affects: [068-02-usemessages-delegation, 068-03-chatarea-listener-deletion, 068-04-devtwopanemock-second-consumer]

# Tech tracking
tech-stack:
  added: [zustand@^5.0.13]
  patterns:
    - "Curried `create<StreamsState>()(...)` v5 type-inference form (RESEARCH §Finding #1)"
    - "Module-level EMPTY_ARRAY stable identity for atomic selectors (RESEARCH §Finding #1)"
    - "Provider-scoped refs + setState-in-useEffect action registration (RESEARCH §Pattern 4 / §Pitfall 3)"
    - "Throwing-stub pre-mount protection for async actions; no-op stubs for sync actions (RESEARCH §Pitfall 5)"
    - "Zustand-visible Set<string> mirror of provider-scoped AbortController Map (RESEARCH §Finding #2 — AbortController never in Zustand state)"
    - "Immutable nested-Map replace pattern for bucketsBySurface (RESEARCH §Pattern 3 / D-068-04)"
    - "Named-hook abstraction layer hides raw useStreamsStore (D-068-02 / D-068-03)"

key-files:
  created:
    - "frontend/src/stores/streamsStore.ts (91 LOC)"
    - "frontend/src/providers/StreamsProvider.tsx (247 LOC)"
    - ".planning/phases/068-streamsprovider-context-lift/deferred-items.md (pre-existing failures log)"
  modified:
    - "frontend/package.json (+1 line: zustand dep)"
    - "frontend/package-lock.json (+625 packages — zustand pulled in fresh tree)"
    - "frontend/src/App.tsx (+12/-9: import + wrap)"

key-decisions:
  - "Mounted <StreamsProvider> as OUTER wrapper around <TooltipProvider> below auth gate (RESEARCH §Finding #4 sane-default — only authenticated users get a store, no cross-auth state leakage)"
  - "Real implementations registered for setMessagesForBucket / clearThreadBucket / setViewingThread / reconcile-shell — even in Plan 1 — because Task 3 listener wiring needs them callable; sendMessage / stopStream / resumeFromFailed / loadMessages remain LIFT-IN-PLAN-2 throwing stubs"
  - "Pre-existing test/build failures (4 vitest, 30 TS) deemed out-of-scope per executor scope-boundary rule — same counts reproduce on baseline; documented in deferred-items.md"

patterns-established:
  - "Curried `create<T>()(...)` Zustand v5 inference form (mandatory for v5 — RESEARCH §Finding #1)"
  - "Provider-scoped refs + mount-time action registration via useStreamsStore.setState — closes over refs without serialization issues (RESEARCH §Pattern 4)"
  - "Set<string> Zustand-mirror of non-serializable refs (subscriptionsByRunId mirrors subscriptionsRef) — exposes 'is run subscribed?' to React consumers without putting AbortController in state"
  - "L-068-01 verbatim guard predicate pattern: lift the EXACT text of an invariant-bearing predicate into the new location (grep-verifiable acceptance criterion)"
  - "L-068-03 sole-writer pattern: exactly ONE assignment expression to a ref in the entire file — enforced via grep count == 1"

requirements-completed: [STREAMS-PROVIDER-01]

# Metrics
duration: 7m 18s
completed: 2026-05-12
---

# Phase 068 Plan 01: StreamsProvider Substrate Landing Summary

**Zustand v5 store + `<StreamsProvider>` with 5 provider-scoped refs, 4 named hooks, reconcile listeners, and L-068-01/02/03 invariant shapes — mounted below auth gate in App.tsx with zero functional change to the existing chat code path.**

## Performance

- **Duration:** 7m 18s
- **Started:** 2026-05-12T18:58:58Z
- **Completed:** 2026-05-12T19:06:16Z
- **Tasks:** 4
- **Files modified:** 5 (2 created + 3 modified, plus 1 deferred-items doc)

## Accomplishments
- Zustand v5.0.13 installed and locked as runtime dep (D-068-01 — substrate exists)
- `frontend/src/stores/streamsStore.ts` (91 LOC) — curried `create<StreamsState>()(...)` store with `bucketsBySurface: Map<SurfaceId, Map<threadId, Message[]>>`, `subscriptionsByRunId: Set<string>` mirror, and 8-action surface seeded with no-op / throwing stubs
- `frontend/src/providers/StreamsProvider.tsx` (247 LOC) — provider component with 5 refs lifted verbatim from `useMessages.ts:417-447`, mount-time action registration via `useStreamsStore.setState`, reconcile listeners attached in-place (gated on `activeThreadIdRef.current`), unmount cleanup mirroring `useMessages.ts:1209-1214`
- 4 named hooks exported (useThreadMessages, useViewingThread, useStreamActions, useStreamSubscriptions) with atomic selectors + module-level `EMPTY_ARRAY` stable identity
- L-068-01 Branch D-3 guard predicate (`tid && tid !== streamingThreadIdRef.current`) physically present in `clearThreadBucket` action body — verbatim match to acceptance-criterion grep
- L-068-02 reconcile in-flight lock shell present (top-of-function bail + try/finally; Plan 2 fills the body)
- L-068-03 sole-writer pattern enforced — exactly 1 `activeThreadIdRef.current =` assignment expression in StreamsProvider.tsx
- `<StreamsProvider>` mounted as outer wrapper around `<TooltipProvider>` below auth gate in `App.tsx` — only authenticated users get a store
- `useMessages.ts` UNTOUCHED (Plan 1 = pure substrate landing); ChatArea.tsx:162-187 listener block UNCHANGED (Plan 3 deletes it; L-068-02 lock makes double-attach safe per RESEARCH §Pitfall 4)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install zustand@^5.0.13 dependency** — `901ff44` (chore)
2. **Task 2: Create `streamsStore.ts` with Zustand v5 store + throwing-stub actions** — `887b268` (feat)
3. **Task 3: Create `StreamsProvider.tsx` with refs, listeners, action registration** — `671005a` (feat)
4. **Task 4: Wrap `<ChatLayout>` in `<StreamsProvider>` in App.tsx** — `16a06ae` (feat)

Plus:

- `e277e29` (docs) — deferred-items.md log of pre-existing test/build failures (out-of-scope per scope boundary rule)

## Files Created/Modified
- `frontend/src/stores/streamsStore.ts` — Zustand v5 store module: type contract + initial state + stubs. State shape: `bucketsBySurface`, `viewedThreadId`, `isStreaming`, `fallbackNotice`, `subscriptionsByRunId` (Set<string> mirror). 8-action surface seeded with `notMounted` async stubs / `() => {}` sync stubs. ~91 LOC.
- `frontend/src/providers/StreamsProvider.tsx` — Provider component owning 5 refs (subscriptionsRef AbortController Map, lastSeenOffsetRef cursor Map, reconcileInFlightRef bool, streamingThreadIdRef, activeThreadIdRef). Three useEffects: #1 registers real actions via setState (setMessagesForBucket + clearThreadBucket + setViewingThread + reconcile-shell are real; the four async stream actions stay LIFT-IN-PLAN-2 throwing stubs), #2 attaches visibilitychange/focus/pageshow listeners gated on activeThreadIdRef.current, #3 unmount-aborts all AbortControllers. Plus 4 named hooks at module level. ~247 LOC.
- `frontend/src/App.tsx` — Added `import { StreamsProvider } from "@/providers/StreamsProvider"`; wrapped existing `<TooltipProvider>...<ChatLayout/>...</TooltipProvider>` in `<StreamsProvider>` (outer). Auth gate (`if (!user) return <AuthPage />`) preserved untouched.
- `frontend/package.json` — Added `"zustand": "^5.0.13"` to dependencies.
- `frontend/package-lock.json` — Resolved zustand@5.0.13 plus 624 transitive deps (fresh npm install rebuild — many already-installed but lockfile newly seeded).
- `.planning/phases/068-streamsprovider-context-lift/deferred-items.md` — Out-of-scope log: 4 pre-existing vitest failures + 30 pre-existing TS errors, verified identical counts before and after Plan 068-01.

## Decisions Made
- **Real action implementations registered in Plan 1 for setMessagesForBucket, clearThreadBucket, setViewingThread, and reconcile (no-op body)**. The plan said "real `setMessagesForBucket` + `clearThreadBucket` + `setViewingThread` + `reconcile` no-op shell" and "LIFT-IN-PLAN-2 markers for sendMessage/stopStream/resumeFromFailed/loadMessages" — so Task 3's listener wiring needs those four real, the other four can throw. Implemented per spec.
- **`subscriptionsByRunId` initialized as empty Set in streamsStore.ts**. Plan 2 will wire add/remove mutations inside the lifted sendMessage/reconcile/stopStream bodies. Plan 1 ships the type-level contract only.
- **Outer-wrapper position for `<StreamsProvider>` (above `<TooltipProvider>`)**. Matches RESEARCH §Finding #4 sane-default ("below auth gate, above router-style children"). TooltipProvider has no dependency on store state, so the order is purely conventional — outer = provider that owns state lifetime; inner = providers that depend on / decorate that state.

## Deviations from Plan

### Out-of-scope discoveries (not auto-fixed; documented in deferred-items.md)

**1. [Scope Boundary] Pre-existing vitest failures (4) — NOT caused by Plan 068-01**
- **Found during:** Task 4 verification (`npm test`)
- **Issue:** 4 tests fail on this branch (MessageItem.test.tsx full file; model-info.test.ts costTier check; api.test.ts listSkillFiles / uploadSkillFile / deleteSkillFile). Root cause for api tests: assertion expects `http://localhost:8000/...` but mock receives `undefined/...` — API_BASE env var unset in test env.
- **Verification of pre-existence:** Stashed Plan 068-01 App.tsx change, re-ran `npm test` — identical 4-failure result.
- **Action:** Logged in `deferred-items.md`. Per executor scope-boundary rule, fixes belong in a dedicated cleanup phase. Plan 068-01 did NOT touch any of these files.
- **Committed in:** `e277e29` (docs log)

**2. [Scope Boundary] Pre-existing TypeScript build errors (30) — NOT caused by Plan 068-01**
- **Found during:** Task 4 verification (`npm run build`)
- **Issue:** `tsc -b` reports 30 errors across FolderNode/FolderTree test props, IngestionPage missing `beforeEach` import, SettingsPage `web_search_enabled` / `tooltip` prop drift, SkillFormDialog RefObject nullability, useDocuments Promise return-type mismatch, several unused-variable errors.
- **Verification of pre-existence:** Stashed Plan 068-01 App.tsx change, re-ran `npm run build` — identical 30-error count.
- **Action:** Logged in `deferred-items.md`. Same scope-boundary reasoning: zero of these files were touched by Plan 068-01.
- **Note:** The acceptance criteria in PLAN.md (`npm test` exit 0 / `npm run build` exit 0) cannot be literally met until baseline cleanup happens. The CORRECT interpretation per scope-boundary rule is: **Plan 068-01 introduced ZERO new errors and ZERO new test failures** — verified by direct A/B comparison.
- **Committed in:** `e277e29` (docs log)

---

**Total deviations:** 2 documented (both scope-boundary — pre-existing failures outside this plan's surface)
**Impact on plan:** None. New files compile clean (`tsc --noEmit` on streamsStore.ts + StreamsProvider.tsx + App.tsx reports 0 errors). All acceptance criteria related to file shape, grep counts, and architectural invariants (L-068-01/02/03) pass.

## Issues Encountered

- **Comment-text grep over-count for L-068-03**: Initial draft of `StreamsProvider.tsx` had three matches of `activeThreadIdRef\.current\s*=` because two were inside `/* */` comments describing the invariant. Per the L-068-03 acceptance criterion (exactly 1 assignment expression), edited the comment text to avoid the literal pattern. Final count: 1. Resolved before the Task 3 commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 2 entry conditions confirmed:
- `<StreamsProvider>` mounted below auth gate in App.tsx — store accessible from any descendant.
- Named hooks (`useThreadMessages`, `useStreamActions`, `useStreamSubscriptions`, `useViewingThread`) compile clean and are ready for consumption.
- L-068-02 in-flight lock shape present in `reconcile` action — Plan 2 can fill the body without re-deriving the lock pattern.
- L-068-01 Branch D-3 guard predicate already verbatim in `clearThreadBucket` — Plan 2 can call it from `useMessages`'s lifted-out clear path without re-asserting the predicate.
- `subscriptionsByRunId: Set<string>` mirror declared in store; Plan 2 wires add/remove at sendMessage / reconcile / stopStream call sites.
- 4 LIFT-IN-PLAN-2 stubs (sendMessage, stopStream, resumeFromFailed, loadMessages) have inline markers — `grep -n "LIFT-IN-PLAN-2"` finds the 4 sites Plan 2 must replace.

Concerns / blockers:
- **Pre-existing test/build failures** (deferred-items.md). Plan 2's verification gates also require `npm test` / `npm run build` to exit 0 — this will continue to fail at baseline. Recommend a cleanup phase before Plan 2 (or relax Plan 2's verification gate to "no NEW failures introduced", matching how Plan 068-01 closed out).

---

## Self-Check: PASSED

Files exist:
- FOUND: `frontend/src/stores/streamsStore.ts`
- FOUND: `frontend/src/providers/StreamsProvider.tsx`
- FOUND: `frontend/src/App.tsx` (modified)
- FOUND: `frontend/package.json` (modified)
- FOUND: `frontend/package-lock.json` (modified)
- FOUND: `.planning/phases/068-streamsprovider-context-lift/deferred-items.md`

Commits exist on branch `worktree-agent-aa180cad60b87864e`:
- FOUND: `901ff44` chore(068-01): install zustand@^5.0.13 dependency
- FOUND: `887b268` feat(068-01): add Zustand v5 streamsStore skeleton
- FOUND: `671005a` feat(068-01): add StreamsProvider with refs, listeners, action registration
- FOUND: `16a06ae` feat(068-01): wrap ChatLayout in <StreamsProvider> below auth gate
- FOUND: `e277e29` docs(068-01): log pre-existing test/build failures as deferred items

Acceptance criteria for new files: PASSED (all grep counts, LOC, TypeScript checks of own files green; pre-existing build/test failures verified out-of-scope via baseline A/B).

---
*Phase: 068-streamsprovider-context-lift*
*Plan: 01*
*Completed: 2026-05-12*
