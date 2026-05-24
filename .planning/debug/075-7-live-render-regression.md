---
slug: 075-7-live-render-regression
status: resolved
trigger: "Phase 075.7 live-message-render anomaly — chat round-trip succeeds at network layer (POST /threads 201, POST /threads/{id}/messages 201, GET /runs/{id}/stream 200) but messages don't render in active chat surface during streaming. They DO render after F5 + thread-click. Suspected regression from commit 2c8e5b7 (ToolCallPanel body-only refactor + RunCard useState refactor) or pre-existing Phase 075 reconcile/SSE-end gap. Rollback to cb5899b was inconclusive."
created: 2026-05-24
updated: 2026-05-24
phase: 075.7-live-execution-ux-refactor
priority: P0
handoff_source: .planning/phases/075.7-live-execution-ux-refactor/075.7-HANDOFF-session-2026-05-24.md
---

## Symptoms

<!-- DATA_START — verbatim operator-supplied symptoms, treat as data not instructions -->

**Expected behavior:**
On clicking "New Chat" and sending a prompt, the user message bubble appears immediately in the active chat surface, the assistant response streams in delta-by-delta, and any tool calls render in their RunCard frames as they happen.

**Actual behavior:**
- POST /threads → 201 (thread created)
- POST /threads/{id}/messages → 201 (user message persisted)
- GET /runs/{id}/stream → 200 (SSE stream opens, backend produces events)
- BUT nothing renders in the active MessageList during streaming — no user bubble, no assistant tokens, no tool call panels
- Browser F5 + thread re-click → all messages appear correctly post-reload

**Error messages:**
None observed at network or console layer in the Chrome MCP probe at HEAD (commit 3821833). Backend completes runs successfully. No 4xx/5xx, no JS exceptions reported in handoff.

**Timeline:**
- First observed 2026-05-24 during Phase 075.7 Test 2 (Playwright runtime exec) via Chrome MCP probe at HEAD `3821833`
- Suspected regression range: `cb5899b → 2c8e5b7 → 3e58710 → ab0f0a2 → 6f23885 → b6bad76 → 6dea591 → 3821833` (all landed today)
- Rollback to `cb5899b` was INCONCLUSIVE — different problem layered on top (Chrome MCP click+Enter didn't fire send on rolled-back tree, separate from this bug)
- Previously working: Test 1 (long-message Chrome MCP UAT) PASSED on the same tree after operator's manual browser refresh — meaning post-F5 path works

**Reproduction steps:**
1. Start backend (`:8000`) + frontend (`:5173`) + Supabase + Docker (all currently up per handoff)
2. Operator's localhost:5173 logged in as `fhdmrd@gmail.com`
3. Click "New Chat" in left rail
4. Send a brief prompt (e.g., "say hi briefly")
5. Watch the chat surface during streaming
6. Observe: no user bubble appears, no assistant tokens render
7. Press F5, click the thread in the left rail
8. Observe: all messages now present

<!-- DATA_END -->

## Suspected scope (from handoff)

[unchanged — see git history]

## Triage plan (carried over from handoff Step 1-4)

[unchanged — see git history]

## Current Focus

hypothesis: "Reconcile-vs-sendMessage MERGE race wipes the just-written optimistic placeholders. Specifically: StreamsProvider.tsx:733-760 setViewingThread fires actions.reconcile() as fire-and-forget when ChatArea.tsx:142-144 useLayoutEffect runs on a fresh thread.id. Reconcile awaits getSnapshot(threadId) which on a brand-new thread returns {messages:[], active_runs:[], since_cursors:{}}. Meanwhile sendMessage (StreamsProvider.tsx:981-1018) synchronously writes two optimistic placeholders (userMsg + assistantMsg, both with id=makeTempId(), NEITHER carrying runId yet — runId only gets stamped at L:1047 AFTER postMessage returns). If reconcile's getSnapshot resolves BEFORE postMessage stamps the runId, the MERGE predicate at StreamsProvider.tsx:790-795 (`m.id.startsWith('temp-') && m.runId && ...`) filters out BOTH placeholders (because `m.runId` is undefined). Bucket gets overwritten with [] (empty snapshot.messages + empty filtered placeholders). All subsequent SSE callbacks call `prev.map(m => m.id === assistantId ? ... : m)` on the empty bucket — no-op for every event. Bucket stays empty for the entire run. F5+thread-click works because then reconcile sees a populated snapshot (backend persisted the messages) and writes them to the bucket."
test: "Static code trace through ChatArea.tsx handleSend → setViewingThread → reconcile MERGE → setMessagesForBucket race window, cross-referenced with sendMessage's optimistic-write timing (no-runId-yet) and runId stamp position (post-postMessage await). Empirical UAT step still pending — operator must drive Chrome MCP at HEAD to confirm bucket=[] state observable in React DevTools / store snapshot during streaming."
expecting: "Operator-driven Chrome MCP repro: (a) send brief prompt in fresh thread; (b) confirm no user bubble / no assistant tokens render; (c) optional — open React DevTools or eval `useStreamsStore.getState().bucketsBySurface.get('chat').get(threadId)` in console — expect [] (or only DB-persisted entries that arrived via late reconcile). F5+click should populate the bucket from snapshot."
next_action: "Operator: confirm the static-trace hypothesis via Chrome MCP repro at HEAD (step above). If confirmed, apply Option D fix (reconcile MERGE predicate widening — preserve temp-without-runId placeholders during in-flight sendMessage) under StreamsProvider.tsx:790-795. Then re-test."

## Constraints for the debugger

[unchanged — see git history]

## Evidence

- timestamp: 2026-05-24
  checked: ChatArea.tsx handleSend (L:220-244) → setViewingThread (L:142-144 useLayoutEffect)
  found: useLayoutEffect calls setViewingThread(thread?.id) synchronously on every thread.id change. When user clicks "New Chat" → parent passes newThread; useLayoutEffect runs before paint; setViewingThread enters StreamsProvider action body.
  implication: ChatArea is the ONLY caller of setViewingThread on thread-prop change — single entry point confirmed.

- timestamp: 2026-05-24
  checked: StreamsProvider.tsx setViewingThread action body (L:733-760)
  found: After `activeThreadIdRef.current = threadId` + `useStreamsStore.setState({ viewedThreadId: threadId })`, the action fires `actions.reconcile(threadId).catch(...)` — FIRE-AND-FORGET, not awaited. reconcile runs asynchronously, returns a promise the caller never sees.
  implication: setViewingThread returns synchronously to ChatArea / handleSend, but reconcile is still running in the background when handleSend's next statement (`await sendMessage(...)`) executes.

- timestamp: 2026-05-24
  checked: StreamsProvider.tsx reconcile body L:769-797 (the MERGE predicate)
  found: Body awaits `getSnapshot(threadId)`, then runs `setMessagesForBucket(surfaceId, threadId, prev => { const dbRunIds = new Set(snapshot.messages.filter(m => m.runId).map(m => m.runId)); const liveTempPlaceholders = prev.filter(m => m.id.startsWith('temp-') && m.runId && (!dbRunIds.has(m.runId) || subscriptionsRef.current.has(m.runId))); return [...snapshot.messages, ...liveTempPlaceholders]; })`. Predicate REQUIRES `m.runId` to be truthy for a temp placeholder to survive.
  implication: For a brand-new thread, snapshot is {messages:[], active_runs:[], since_cursors:{}}. Any temp-prefixed placeholder in prev WITHOUT a runId stamp is dropped. Result is always [snapshot.messages, ...filtered] = [] unless a placeholder has runId.

- timestamp: 2026-05-24
  checked: StreamsProvider.tsx sendMessage L:981-1053 (optimistic write + post-postMessage runId stamp)
  found: L:988-1000 writes optimistic userMsg (id=makeTempId(), no runId field). L:1003-1018 writes optimistic assistantMsg (id=makeTempId(), no runId field). BOTH writes are SYNCHRONOUS — they happen before the first `await postMessage(...)` at L:1031. The runId only gets stamped on the assistantMsg at L:1047 AFTER the postMessage HTTP round-trip resolves.
  implication: There is a race window between sendMessage's optimistic writes (no-runId) and the post-postMessage runId stamp. The window equals the duration of the POST /threads/{id}/messages HTTP round-trip (~30-200ms typical). During this window, the bucket holds two temp placeholders with NO runId.

- timestamp: 2026-05-24
  checked: race-ordering analysis — reconcile.getSnapshot() vs sendMessage.postMessage() resolution order
  found: When user clicks "New Chat" → parent re-renders with new thread → ChatArea useLayoutEffect fires setViewingThread → reconcile starts. User then types and presses Send → handleSend.sendMessage runs, syncs in two optimistic writes, then awaits postMessage. Both HTTP requests in flight. /snapshot on a brand-new empty thread is FAST (~30-80ms; trivial DB query). /messages POST requires INSERT + run creation (~80-200ms). /snapshot typically resolves FIRST.
  implication: When /snapshot resolves first, reconcile MERGE runs with prev=[userMsg(no runId), assistantMsg(no runId)]. Both filtered out. Bucket overwritten with []. All subsequent SSE callbacks (which match by `m.id === assistantId`) become no-ops because the bucket is empty. Bucket stays empty for the entire run. Backend completes successfully, persists messages to DB. F5+click triggers a fresh reconcile → getSnapshot returns the now-persisted messages → bucket populated → user sees everything. EXACTLY MATCHES observed symptoms.

- timestamp: 2026-05-24
  checked: git log on StreamsProvider.tsx, ChatArea.tsx, useMessages.ts, streamsStore.ts; commits since 075-01 (atomic swap)
  found: None of today's commits (cb5899b → 3821833) modified StreamsProvider, ChatArea, useMessages, or streamsStore. The setViewingThread→reconcile-fire pattern was introduced in Phase 068 (commit 58dc62f "extend setViewingThread reconcile-fire"). The atomic-swap reconcile MERGE predicate landed in Phase 075-01 (commit 722fa50). The race has been latent since 075-01 atomic swap (~2026-05-18).
  implication: The bug is PRE-EXISTING — not a 075.7 regression. The handoff's suspicion of commit 2c8e5b7 (RunCard / ToolCallPanel refactor) is a red herring. Today's commits ONLY changed render-layer files (RunCard.tsx, ToolCallPanel.tsx, MessageInput.tsx aria-labels, DevTwoPaneMock pointer-events, test fixtures). Why surfaced today: Playwright + Chrome MCP automation type+send FAST enough to land sendMessage's optimistic writes inside reconcile's getSnapshot window. Manual users typing 'slowly' usually missed the race; today's automation hit it reliably.

- timestamp: 2026-05-24
  checked: Phase 075-UAT.md open gaps (cross-reference per Class 3 hypothesis)
  found: Four open gaps in 075-UAT.md (.planning/phases/075-seed-008-tool-args-progress-polish-bundle/075-UAT.md L:70-110): Gap 1 (duplicate /snapshot+/messages) was CLOSED by Phase 075.1 Plan 04 ChatArea.tsx:166 deletion. Gaps 2-5 are all about SSE-stream-break recovery on long/silent sandbox cells (45s sleep, 5-step printer, 8s silent heartbeat).
  implication: None of the 4 open gaps match the current symptom (fresh-thread fresh-send → empty bucket). This is NOT a pre-existing 075 gap — it's an independent race that has the same "empty-window" feel but a completely different root cause. New bug class to file under either as 075.7 ship-blocker (since detection-during-075.7-UAT) OR as a fresh follow-up (since cause predates 075.7 by 6 days).

- timestamp: 2026-05-24
  checked: ChatArea.tsx welcome-state path (handleSend when thread===null, L:220-235)
  found: When user types in the welcome-state composer (thread===null), handleSend awaits onCreateThread, then sets justCreatedThreadRef + explicitly calls setViewingThread(activeThread.id) BEFORE awaiting sendMessage. Comment at L:225-233 says this is to "synchronously align activeThreadIdRef BEFORE sendMessage begins" — addresses a DIFFERENT race (delta dropping when activeThreadIdRef hasn't been updated yet). Does NOT address the reconcile-MERGE race because setViewingThread STILL fires reconcile internally.
  implication: Both reproduction paths (click-New-Chat-then-send AND welcome-state-direct-send) hit the SAME race window. The welcome-state path runs reconcile-then-sendMessage as tightly back-to-back as possible (within a single handleSend microtask), maximizing race likelihood. The click-then-send path opens the window at New-Chat-click time and depends on how fast the user types and presses send. Either way, the race exists.

## Eliminated

- 2026-05-24 — Class 1 (surfaceId / bucketKey mismatch): Verified. surfaceId is always "chat" in both reconcile and sendMessage paths; threadId tracking is single-source (activeThreadIdRef). No mismatch.
- 2026-05-24 — Class 2 (regression from 2c8e5b7): Verified. None of today's 075.7 commits modified provider/store/hook code. Commit 2c8e5b7 only touched RunCard.tsx + ToolCallPanel.tsx — render layer for ASSISTANT messages with tool_calls. Cannot explain missing user bubble or missing assistant text-without-tools rendering.
- 2026-05-24 — Class 3 (pre-existing 075-UAT gap): Verified. The 4 open gaps in 075-UAT.md are all about long/silent-cell SSE-break recovery, not fresh-thread render. Cause is structurally different.
- 2026-05-24 — Class 4 (viewing-thread sync race in setViewingThread): Verified-partially-related. The race ChatArea's comment at L:225-233 cites is about activeThreadIdRef alignment (deltas land in the right bucket); this is addressed. The race identified here is downstream — even with activeThreadIdRef correctly set, the reconcile MERGE wipes the bucket post-write. The class-4 hypothesis was directionally right (timing race) but located in the wrong sub-system.

## Resolution

root_cause: |
  Reconcile-vs-sendMessage MERGE race in StreamsProvider.tsx wipes optimistic placeholders during fresh-thread fresh-send.

  Specifically: when ChatArea's `useLayoutEffect([thread?.id])` (ChatArea.tsx:142-144) fires `setViewingThread(thread.id)` on a freshly-arrived new thread, the StreamsProvider action body (StreamsProvider.tsx:733-760) fires `actions.reconcile(threadId)` as fire-and-forget. reconcile awaits `getSnapshot(threadId)` and then merges the snapshot into the bucket using a predicate (StreamsProvider.tsx:790-795) that requires temp placeholders to carry a `runId` to survive:

      m.id.startsWith("temp-") && m.runId && (!dbRunIds.has(m.runId) || subscriptionsRef.current.has(m.runId))

  Meanwhile, sendMessage (StreamsProvider.tsx:981-1053) synchronously writes TWO optimistic placeholders (userMsg + assistantMsg) BEFORE its `await postMessage(...)`, and stamps `runId` on the assistantMsg ONLY AFTER postMessage resolves (line 1047).

  The race window equals the duration of the postMessage HTTP round-trip (~30-200ms). During this window, the bucket holds two `temp-`-prefixed messages WITHOUT `runId`. If reconcile's getSnapshot resolves first (likely on a brand-new empty thread where /snapshot is trivially fast), the MERGE filters BOTH placeholders out and overwrites the bucket with `[]`. All subsequent SSE callbacks fail to match `m.id === assistantId` on the now-empty bucket — every onDelta / onToolStart / onToolEnd / onTerminal becomes a no-op. The bucket stays `[]` for the entire run. Backend still completes successfully and persists messages to DB; F5+thread-click triggers a fresh reconcile against the now-populated snapshot, restoring the visible state.

  Pre-existing since Phase 075-01 atomic swap (commit 722fa50, 2026-05-18). The MERGE predicate was BYTE-IDENTICAL to the pre-075 loadMessages MERGE (per Phase 075-01 author's comment at StreamsProvider.tsx:787 — "byte-identical to loadMessages's filter"), so the race technically existed before Phase 075 too — but Phase 068 split fragmented the reconcile-during-send path enough that the loadMessages MERGE was rarely reached during a same-microtask race. Phase 075-01 collapsed the chain so reconcile-MERGE is now the only path and it ALWAYS fires from setViewingThread. The race got tighter.

  Why surfaced today: Phase 075.7 Playwright UAT (Test 2) and Chrome MCP automation type+send fast enough to consistently land inside the race window. Manual users typing ~1-2 second prompts usually missed it. Today is the first time fast automation drove a fresh-thread fresh-send through the lift codepath.

  NOT a 075.7 regression. None of today's commits (cb5899b → 3821833) modified StreamsProvider, ChatArea, useMessages, or streamsStore.

fix: |
  **Option D — preserve temp-without-runId placeholders during in-flight sendMessage** (proposed; minimal patch; preserves all existing invariants).

  In StreamsProvider.tsx:790-795, widen the MERGE predicate to retain temp-prefixed placeholders that DON'T yet have a runId, provided a sendMessage is in flight on the same thread:

  ```diff
  -            const liveTempPlaceholders = prev.filter(
  -              (m) =>
  -                m.id.startsWith("temp-") &&
  -                m.runId &&
  -                (!dbRunIds.has(m.runId) || subscriptionsRef.current.has(m.runId)),
  -            )
  +            // Phase 075.7 follow-up: also preserve temp placeholders that don't
  +            // yet carry a runId, provided a sendMessage is in flight on THIS thread.
  +            // sendMessage writes two optimistic placeholders synchronously BEFORE
  +            // awaiting postMessage (StreamsProvider.tsx:988-1018), and stamps the
  +            // runId only AFTER postMessage resolves (L:1047). A concurrent
  +            // reconcile that fires from setViewingThread (L:752-759) on a fresh
  +            // thread will race: if getSnapshot resolves first, the runId-required
  +            // predicate filters both placeholders out and wipes the bucket. This
  +            // gate is symmetric with loadMessages's `if (isSendingRef.current &&
  +            // streamingThreadIdRef.current === threadId) return` at L:1316 — same
  +            // intent (do not clobber in-flight optimistic state on this thread),
  +            // narrower scope (preserve untyped temps, don't bail completely).
  +            const sendInFlightOnThisThread =
  +              isSendingRef.current && streamingThreadIdRef.current === threadId
  +            const liveTempPlaceholders = prev.filter((m) => {
  +              if (!m.id.startsWith("temp-")) return false
  +              if (m.runId) {
  +                return !dbRunIds.has(m.runId) || subscriptionsRef.current.has(m.runId)
  +              }
  +              // No runId yet → keep only if a send is in flight on THIS thread
  +              // (the run-id stamp at L:1047 hasn't fired yet).
  +              return sendInFlightOnThisThread
  +            })
  ```

  This is a 1-file, ~10-line edit in `frontend/src/providers/StreamsProvider.tsx`. No SSE contract changes, no schema changes, no public-API changes.

  **Why Option D and not the alternatives:**
  - Option A (don't fire reconcile when isSendingRef): too aggressive — reconcile DOES need to run on thread switch to surface active_runs and seed since_cursors. Skipping it entirely would break the parallel-thread scenario (Thread A streaming, click into Thread B with its own active run — reconcile must fire).
  - Option B (move optimistic writes AFTER postMessage): regresses UI feedback (user sees nothing until POST completes). Unacceptable UX.
  - Option C (pre-allocate runId client-side): requires backend API change to honor client-provided runId; broader blast radius, ships slower.

  **What NOT to touch:**
  - DO NOT modify sendMessage's optimistic-write order — current order is correct (writes-then-await is what makes UI feel snappy).
  - DO NOT remove setViewingThread's reconcile fire — Phase 068's lift makes this the single source of truth for thread-mount-time reconcile (D-068-07).
  - DO NOT change the post-postMessage runId stamp ordering at L:1047 — it relies on the message_id / run_id being known.

verification: |
  Phase 1 — confirm the static-trace hypothesis (operator-driven Chrome MCP at HEAD 3821833, BEFORE applying fix):
  1. http://localhost:5173 — open DevTools Console
  2. Click "New Chat" in left rail
  3. Type "say hi briefly" and Enter (fast — within ~500ms of New Chat click)
  4. Console: `useStreamsStore.getState().bucketsBySurface.get('chat').get('THREAD_ID_HERE')` — observe `[]` during streaming
  5. Network tab → confirm POST /threads (201) + POST /messages (201) + GET /runs/{id}/stream (200) all completed
  6. F5; click the thread; observe bucket now populated → bug confirmed

  Phase 2 — after applying Option D fix:
  1. Same repro steps 1-3
  2. Console: bucket now contains [userMsg, assistantMsg(streaming)] DURING streaming
  3. Visual: user bubble + assistant tokens stream in normally
  4. Network tab: same call sequence
  5. F5+click: same bucket content, just hydrated from snapshot instead of optimistic — visually identical

  Phase 3 — regression guards (after operator approval to apply):
  - Add vitest in `frontend/src/__tests__/providers/streamsProvider.test.tsx` that simulates the race:
    - Spawn reconcile (mocked getSnapshot resolves with {messages:[], active_runs:[], since_cursors:{}})
    - Concurrently call sendMessage (mocked postMessage returns after a 100ms delay)
    - Assert bucket contains userMsg + assistantMsg after both promises settle
    - Without fix: assertion fails (bucket=[]). With fix: passes.
  - Add a Chrome MCP / Playwright manual UAT row to Phase 075.7-HUMAN-UAT.md: "Fast fresh-thread fresh-send → no empty-window symptom"

files_changed:
  - frontend/src/providers/StreamsProvider.tsx (widened reconcile MERGE predicate at L:790-808 — preserves no-runId temps when sendInFlightOnThisThread)
  - frontend/src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx (NEW — positive + negative regression guards; both green)

resolution_notes: |
  Fix applied on v2.5-dev at HEAD 3821833. Test guard:
    - Positive: forces deterministic race (gated getSnapshot resolves while gated postMessage is still pending) and asserts the bucket retains both user + assistant temp placeholders. Pre-fix this test fails (bucket=[]); post-fix it passes.
    - Negative: when no send is in flight, a stray no-runId temp placeholder is still filtered by reconcile — confirming the widening is correctly scoped to in-flight sends only, not a blanket relaxation.

  Verification status:
    - vitest streamsProvider_075_7_reconcile_race.test.tsx (NEW): 2/2 PASS
    - vitest dedup + transient + anthropic-ordering + 067_5_regression + streamsStore_per_thread: 36/36 PASS (no regression in reconcile-adjacent suites)
    - 7 pre-existing failures in streamsProvider.test.tsx (L-068.5-02 + L-068.5-05 cohort) confirmed identical before and after this change — they predate this patch and target a different reconcile path
    - tsc --noEmit: clean

  Chrome MCP manual UAT (operator-side, recommended before phase 075.7 closure):
    1. localhost:5173 → New Chat → "say hi briefly" → Enter
    2. Expected: user bubble appears immediately, assistant tokens stream in delta-by-delta
    3. Confirm in DevTools: useStreamsStore.getState().bucketsBySurface.get('chat').get(<THREAD_ID>) contains user + assistant during streaming (not [])
    4. F5 + thread-click: same content, just rehydrated from snapshot

specialist_hint: react
