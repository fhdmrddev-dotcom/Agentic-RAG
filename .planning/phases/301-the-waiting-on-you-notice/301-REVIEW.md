---
phase: 301-the-waiting-on-you-notice
reviewed: 2026-10-30T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - backend/app/api/notifications.py
  - backend/app/db/notifications.py
  - backend/app/main.py
  - supabase/migrations/219_notifications_realtime.sql
  - scripts/full-schema-supplement.sql
  - scripts/build-public-openapi.cjs
  - docs/public/api/overview.md
  - backend/tests/integration/test_301_notifications_live.py
  - backend/tests/unit/test_301_migration_219_shape.py
  - backend/tests/unit/test_301_notifications_route.py
  - frontend/src/lib/api/notifications.ts
  - frontend/src/hooks/useWaitingNotices.ts
  - frontend/src/components/layout/attentionConditions.ts
  - frontend/src/components/layout/AttentionPopover.tsx
  - frontend/src/components/layout/WaitingOnYouControl.tsx
  - frontend/src/components/layout/WaitingOnYouList.tsx
  - frontend/src/components/layout/waitingVocabulary.ts
  - frontend/src/components/layout/NavPanel.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/layout/AppViewSwitch.tsx
  - frontend/src/components/org/OrgIdentity.tsx
  - frontend/src/hooks/__tests__/useWaitingNotices.test.tsx
  - frontend/src/components/layout/__tests__/WaitingOnYouControl.test.tsx
  - frontend/src/components/layout/__tests__/attentionTab.test.ts
  - frontend/src/components/layout/__tests__/ChatLayout.badge.test.tsx
  - frontend/src/components/layout/__tests__/NavPanel.badge.test.tsx
  - frontend/src/components/layout/waitingVocabulary.test.ts
  - frontend/src/components/org/OrgIdentity.test.tsx
findings:
  critical: 0
  warning: 2
  info: 7
  total: 9
status: issues_found
---

# Phase 301: Code Review Report

**Reviewed:** 2026-10-30
**Depth:** standard (hot files ChatLayout.tsx, NavPanel.tsx, AppViewSwitch.tsx, main.py reviewed as their `d9ff4c5eb..HEAD` hunks)
**Files Reviewed:** 28
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I checked these focus areas against the code and found them sound:

- **Route security.** `GET /notifications` answers 401 with `WWW-Authenticate: Bearer` from a router-level dependency, which FastAPI runs before the endpoint's `get_current_user` and before any pool access. The unit test proves `rec.calls == []`. `LIST_OPEN_SQL` binds the caller as `$1` in both `n.recipient_id = $1` and `m.user_id = $1`. `org_members` has `UNIQUE (org_id, user_id)`, so the join cannot duplicate rows or inflate `count(*) OVER ()`. The status wall `wr.status IN ('active','paused')` is present. Nothing in the module reads `X-Org-Id`. No question text, `tool_call_id` or `messages` join appears on the wire.
- **Pydantic field types.** The `Literal` types match the DB CHECK constraints (`kind`: question/approval; `origin_kind`: app/schedule/key/NULL). `organizations.name` is NOT NULL, so a stray row cannot turn the whole list into a 500.
- **Migration 219.** It is idempotent and does only the publication add. It is mirrored in supplement §4 and in the regenerated `full-schema.sql` (`cb74b23dc`).
- **Hook behaviour.**
  - The Realtime callback ignores its argument and only calls `refresh()`.
  - Every refetch trigger D-17 names is wired.
  - A failed refetch keeps the last verdict (`verdictKnown` / `failedSinceLast`).
  - Unmount aborts the in-flight fetch, clears the interval, removes both listeners and removes the channel.
  - A `getSession` that resolves after unmount is guarded by `cancelled`.
  - `.then` checks `signal.aborted`, so no state is set after unmount.
- **Badge and partition.**
  - The badge reads `waitingTotal()` (the server's `total`), never a row count.
  - The Library rail badge, its popover and the drawer Library badge read `conditionsForMark(…, "library")`.
  - `attentionCountByTab` skips `waiting` conditions.
  - `LibraryPage` only reads conditions through `attentionCountByTab`.
  - The D-14 inventory fence pins one `useWaitingNotices(` call site.
- **Opening a row.** Rows are `DropdownMenuItem`s whose `onSelect` calls `onOpen()`, which maps to `openRun(run_id)` → `go({view:"workflow-run"})`. Nothing in the path calls `switchOrg`.
- **Status reporting.** `reportWaitingStatus` cannot loop: the effect depends on a string primitive, and `setState` with the same value bails out.

No BLOCKER-class defect was found.

There are two warnings, both about the refetch triggers firing far more often than the design and its tests claim:

- a single mount makes up to three GETs;
- a single org switch makes three GETs;
- returning to the tab makes two.

The suite's "exactly once on mount" fence cannot see this, because its channel double never fires `SUBSCRIBED`.

## Warnings

### WR-01: Refetch fan-out — mount ≈ 3 GETs, tab return = 2 GETs, and the "EXACTLY ONCE on mount" fence is blind to it

**File:** `frontend/src/hooks/useWaitingNotices.ts:106-108, 123-134, 158-160`; `frontend/src/components/layout/__tests__/ChatLayout.badge.test.tsx:115, 361-368`

**Issue:** Each freshness trigger calls `refresh()`, and `refresh()` aborts whatever is in flight and starts a new request. Nothing coalesces triggers that arrive close together. The abort is client-side only: the server still runs `get_current_user` (an auth round trip) plus `LIST_OPEN_SQL` for every request that started. Concrete sequences in the shipped code:

1. **Mount:**
   - (a) the effect at line 106 fires `refresh()`.
   - (b) `OrgProvider`'s probe resolves memberships from `[]` (CLOSED) to the real list, so `membershipKey` changes from `""` to `"a,b"` and the effect at line 106 fires again.
   - (c) the channel joins, and the `subscribe` callback at line 159 receives `SUBSCRIBED`, which fires another `refresh()`.

   That is up to three requests to learn one answer.
2. **Tab return:** the browser fires `visibilitychange` (now `"visible"`) and then `focus`. Lines 125-126 and 124 each call `refresh()`, so two requests go out back-to-back.
3. **Org switch:** see WR-02 (three requests).

`ChatLayout.badge.test.tsx:361` asserts `mockGetWaitingNotices` is called `toHaveBeenCalledTimes(1)` on mount ("D-14"). It passes only because the Supabase double's `subscribe: vi.fn()` (line 115) never invokes its status callback, and the org mock never transitions memberships. The fence asserts a property the product does not have. That matches this project's own rule that a test double which cannot reach the real trigger is a vacuous guard.

**Fix:** Coalesce, and make the fence measure the real triggers.

```ts
// useWaitingNotices.ts — skip a refresh when a fetch is already in flight or one landed very
// recently, except for triggers that change the ANSWER's inputs (org/membership) or a Realtime event.
const lastSettled = useRef(0)
const softRefresh = useCallback(() => {
  if (inFlight.current && !inFlight.current.signal.aborted) return
  if (Date.now() - lastSettled.current < 2_000) return
  refresh()
}, [refresh])
// in refresh(): on settle (success or failure) → lastSettled.current = Date.now(); inFlight.current = null
// use softRefresh for: focus, visibilitychange, SUBSCRIBED, the poll
// keep refresh (abort + restart) for: Realtime events, activeOrgId change
```

In `ChatLayout.badge.test.tsx`, make the channel double's `subscribe` call `cb("SUBSCRIBED")` on a microtask, so the D-14 count measures what ships.

### WR-02: `membershipKey` is not a membership signal — it flaps to `""` on every active-org switch and on any probe failure

**File:** `frontend/src/hooks/useWaitingNotices.ts:101-108` (source: `frontend/src/hooks/useOrgPermissionsProbe.ts:91-93, 101-104`)

**Issue:** `orgs` comes from `useOrgPermissionsProbe`. That hook is keyed on `activeOrgId`, and on every re-key it calls `setPerms(CLOSED)` (memberships `[]`) before the new `/org/me` resolves. A probe failure also leaves memberships at `[]`. So one org switch walks the key `"a,b"` → `"a,b"` (only `activeOrgId` changed) → `""` → `"a,b"`, and fires `refresh()` three times:

1. `activeOrgId` changes;
2. the CLOSED render empties the key;
3. the probe resolves and restores it.

None of those reflect a membership change. The route also ignores the active org entirely (D-15/D-27), so even the first refetch adds nothing. The probe-failure case is worse: a 403 or network error on `/org/me` sets the key to `""`, and the next success flips it back. Each flap costs a GET.

**Fix:** Key only on a settled membership set, and ignore the transient CLOSED state:

```ts
const org = useOrgOptional()
const membershipKey = org && !org.loading   // expose probe `loading` (OrgProvider already has it)
  ? (org.orgs ?? []).map((o) => o.org_id).sort().join(",")
  : null
const lastKey = useRef<string | null>(null)
useEffect(() => {
  if (membershipKey === null || membershipKey === lastKey.current) return
  lastKey.current = membershipKey
  refresh()
}, [membershipKey, refresh])
```

Keep the mount refresh as its own effect. Also consider dropping `activeOrgId` as a trigger: the answer is org-independent, and D-17 only needs it so an org switch reconciles, which a settled membership key plus the Realtime event already cover.

## Info

### IN-01: `ChatLayout` claims the attention context "stays memoised" — it is rebuilt on every `App` render

**File:** `frontend/src/components/layout/ChatLayout.tsx:604, 609-615`

**Issue:** `openLibraryHealth` depends on `onOpenLibraryHealth`, which is `nav.handleOpenLibraryHealth`. That is a plain function, not a `useCallback`, recreated on every `App` render (`useAppNavigation.ts:353`). So `attentionCtx` changes identity on every `App` render. `useWaitingRunConditions`' `[report, status]` effect then re-fires and calls `setWaitingStatus(sameValue)`. It is bounded and does not loop, because `ChatLayout` re-rendering alone does not change the prop. But the comment "setState is stable, so the context stays memoised" is false, and `useStoppedSourceConditions` rebuilds its array every time.

**Fix:** Wrap `handleOpenLibraryHealth` in `useCallback([go])` in `useAppNavigation.ts`, or correct the comment.

### IN-02: Realtime topic reuse during teardown can attach a remount to a dying channel

**File:** `frontend/src/hooks/useWaitingNotices.ts:144, 189-199`

**Issue:** realtime-js 2.99.2's `channel(topic)` returns an existing channel with the same topic (`RealtimeClient.js:277-287`). A removed channel stays in that list until its leave is acknowledged. It stays forever if the leave push answers `error`, because `unsubscribe` resolves without `onClose`. A remount inside that window (for example dev HMR, or any future keyed remount of `ChatLayout`) gets the leaving channel back. `subscribe()` is a no-op on a non-`closed` channel, so no `SUBSCRIBED` ever arrives and hints stay dead for that mount. Poll and focus still cover it, so this costs freshness only.

**Fix:** Use a per-mount topic, e.g. `` `waiting-notices:${uid}:${crypto.randomUUID()}` `` (the `useFolders`/`useDocuments` precedent shares the weakness).

### IN-03: The `switchOrg` spy in `WaitingOnYouControl.test.tsx` is vacuous by construction

**File:** `frontend/src/components/layout/__tests__/WaitingOnYouControl.test.tsx:231, 243, 375`

**Issue:** Neither `WaitingOnYouControl` nor `WaitingOnYouList` imports anything that can reach `OrgProvider`, and each row's `onOpen` is a `vi.fn()`. `expect(switchOrg).not.toHaveBeenCalled()` cannot fail here. The D-08 property ("a row never switches org") actually lives in `ChatLayout.openRunForAttention`, and no test asserts it there.

**Fix:** In `ChatLayout.badge.test.tsx` ("selecting a row from the drawer list…"), mock `OrgProvider` with a `switchOrg` spy and assert it is not called beside `openRun("run-1")`.

### IN-04: Two shell tests synchronise on "called", not on "settled"

**File:** `frontend/src/components/layout/__tests__/ChatLayout.badge.test.tsx:346-359, 457-472`

**Issue:** The MIXED case says *"Both fetches have landed before the count is read — otherwise '1' would be vacuous"*, but it waits on `toHaveBeenCalledTimes(1)`. A call proves the request started, not that its rows rendered. The D-30 negative arm likewise waits on `toHaveBeenCalledTimes(2)` before asserting the dot is absent, and an absent dot is also the state *before* any answer lands. Both pass today only because the preceding `findBy*` act-flush happens to settle the mock.

**Fix:** In the MIXED case, first `await screen.findByTestId("rail-waiting-badge")` and assert `/^2$/`. In the D-30 arm, open the list and await `waiting-empty`, which only an answered zero renders.

### IN-05: An unparseable `created_at` renders a confident wrong phrase

**File:** `frontend/src/components/layout/waitingVocabulary.ts:60-64`

**Issue:** `Number.isNaN(raw) ? 0` turns a parse failure into "waiting under a minute", a false statement about a run that may have waited for days. The wire carries Pydantic's microsecond ISO strings. Any engine that rejects them would silently mislabel every row.

**Fix:** Return `null` for NaN and omit the waited segment in `WaitingOnYouList` when it is null. Keep the clamp for future timestamps.

### IN-06: A server-side English fallback bypasses the vocabulary leaf

**File:** `backend/app/db/notifications.py:208`

**Issue:** `COALESCE(…, 'Workflow run')` means the client's `WAITING_COPY.untitledWorkflow` ("Untitled workflow") can never fire. Instead, a server-owned string reaches the screen, against the leaf's rule that every word comes from `waitingVocabulary`.

**Fix:** Return `''` (or NULL with `workflow_name: str | None`) and let the leaf's fallback own the words.

### IN-07: Verbatim duplicated markup and casts that hide API errors

**File:** `frontend/src/components/layout/AppViewSwitch.tsx:333-340`; `frontend/src/components/layout/WaitingOnYouControl.tsx:39-40`; `frontend/src/components/org/OrgIdentity.tsx:88-89`; `frontend/src/hooks/useWaitingNotices.ts:68, 144-160`

**Issue:**

- The hamburger dot is copied byte-for-byte from `ChatArea.tsx:923-929`.
- `PILL` copies NavPanel's badge class string.
- `OrgAvatar` xs derives its classes by `.replace("h-9 w-9", …)`, which silently becomes a no-op if `AVATAR_BASE` is reworded (the OrgIdentity test pins it, so this risk is only latent).
- The hook casts `supabase.channel()` to `ChannelLike` and invokes `on`/`subscribe` via `.call`, so a misspelled `postgres_changes` filter key would typecheck.
- The hook is not keyed by user: if the session changes from user A to user B without passing through null (cross-tab sign-in), the channel keeps filtering on A's id until remount.

**Fix:**

- Extract one `AttentionDot` and one `WARNING_PILL` constant.
- Give `OrgAvatar` an explicit size map.
- Type the channel as `RealtimeChannel` and keep only the try/catch.
- Re-key the Realtime effect on the session user id, e.g. via `onAuthStateChange`.

---

_Reviewed: 2026-10-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
