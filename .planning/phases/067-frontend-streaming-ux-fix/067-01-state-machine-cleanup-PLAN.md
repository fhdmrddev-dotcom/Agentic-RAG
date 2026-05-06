---
phase: 067
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/hooks/useMessages.ts
  - frontend/src/components/chat/MessageItem.tsx
autonomous: true
requirements:
  - STREAM-04-polish
must_haves:
  truths:
    - "Submitting a prompt renders the optimistic assistant placeholder + first SSE delta within 1s of POST returning {message_id, run_id} (UX-067-01) — backed by Task 1 ordering guarantee: subscriptionsRef slot reserved BEFORE the runId-stamping setMessages so any reconcile racing on a tab visibilitychange/focus/pageshow/mount short-circuits deterministically before its parallel loadMessages can MERGE the temp placeholder away."
    - "Mid-stream UI never displays the literal text 'Saving response…' (UX-067-02)"
    - "After thread switch + reconcile collapses the placeholder, a subsequent terminal SSE event does NOT mutate state for a non-existent assistantId (UX-067-02 invariant: no stale-id stomp)"
    - "Existing Phase 063.1 guards (guardedSetMessages, reconcileInFlightRef, lastSeenOffsetRef, MERGE-preserve-temp-placeholders) are preserved verbatim — extended, not replaced (anti-pattern flag per BLK-1: must NOT replace, per D-063.1-08 / D-063.1-11)"
    - "All setMessages call sites in sendMessage's POST→subscribe handoff window (lines 470, 486, 514, plus the runId stamp) are audited and either guarded or exempt-by-design with documented rationale in code comments"
  artifacts:
    - path: "frontend/src/hooks/useMessages.ts"
      provides: |
        (a) sendMessage POST→subscribe handoff reordered so `subscriptionsRef.current.set(run_id, controller)` happens BEFORE the runId-stamping `setMessages` at line 514 (currently the order is setMessages first → set second; the reorder makes any concurrent reconcile's `subscriptionsRef.current.has(run.run_id)` short-circuit deterministic before its parallel `loadMessages` can MERGE).
        (b) Inline audit comment block at sendMessage line ~497-499 listing each setMessages site in the first-paint window with guard status and rationale.
        (c) Guard-aware terminal-flip in BOTH sendMessage (lines 568-577) and reconcile (lines 807-816) — setMessages updaters wrap in `prev.some((m) => m.id === <id>) ? prev.map(...) : prev` existence check.
      contains: "subscriptionsRef.current.set(run_id, controller)"
    - path: "frontend/src/components/chat/MessageItem.tsx"
      provides: "Banner switch with no 'Saving response…' fallback — terminal-state-only banner copy (timed_out, cancelled, stopped)"
      contains: "Agent reached time limit"
  key_links:
    - from: "useMessages.ts sendMessage POST→subscribe handoff (line 506-521)"
      to: "subscription slot reservation BEFORE the runId-stamping setMessages — reconcile's has(run_id) short-circuit becomes deterministic"
      via: "reorder: set subscriptionsRef BEFORE the second setMessages"
      pattern: "subscriptionsRef\\.current\\.set\\(run_id, controller\\)"
    - from: "useMessages.ts sendMessage onTerminal override (line 561-589)"
      to: "guarded setMessages updater that no-ops on missing assistantId"
      via: "prev.some((m) => m.id === assistantId) ? prev.map(...) : prev"
      pattern: "prev\\.some\\(\\(m\\) => m\\.id === assistantId\\)"
    - from: "useMessages.ts reconcile onTerminal override (line 795-826)"
      to: "guarded setMessages updater that no-ops on missing targetId"
      via: "prev.some((m) => m.id === targetId) ? prev.map(...) : prev"
      pattern: "prev\\.some\\(\\(m\\) => m\\.id === targetId\\)"
    - from: "MessageItem.tsx hasAnyTools branch (line 128-150)"
      to: "no 'Saving response…' literal in the source file"
      via: "deletion of the fallback ': \"Saving response…\"' string + replacement with `: null`"
      pattern: "Saving response"
---

<objective>
Deliver D-067-01's architectural cleanup of the streaming-attach lifecycle: pull SSE attach + optimistic placeholder insertion + reconcile-on-mount into one well-ordered, single-source-of-truth state machine. Concretely, this plan does FOUR things:

1. **Document the current first-paint mutation order** (Task 1 audit comment in source) so future readers see at a glance which setMessages calls fire in what sequence between sendMessage's POST and the first SSE delta.
2. **Reorder the POST→subscribe handoff** so `subscriptionsRef.current.set(run_id, controller)` happens BEFORE the runId-stamping setMessages — this makes reconcile's `subscriptionsRef.current.has(run.run_id)` short-circuit deterministic against the four ChatArea reconcile triggers (mount/visibilitychange/focus/pageshow at ChatArea.tsx:163-188), so a reconcile racing in via tab visibility change cannot fire `loadMessages` AND a parallel `subscribeToRun` against the same run before sendMessage's own subscribeToRun is wired up.
3. **Guard the terminal-flip in both sendMessage (line 568) and reconcile (line 807)** with an existence check so a late-fired terminal SSE cannot stomp a stale assistantId after a competing reconcile collapsed the placeholder via the temp- → DB-row swap.
4. **Delete the "Saving response…" fallback in MessageItem.tsx:140** so banner copy is reserved for terminal states only (matches Claude/ChatGPT).

This is an extend-not-replace pass per CONTEXT.md D-067-01 and the BLK-1 anti-pattern flag: every existing guard from Phase 063.1 (`guardedSetMessages`, `reconcileInFlightRef`, `lastSeenOffsetRef`, MERGE-preserve filter) stays verbatim. The diff is bounded: ~30 LOC of audit comment + reorder + existence checks + one fallback deletion.

Purpose: closes UX-067-01 (real-time first-paint plumbing — the placeholder + first SSE-attach are guaranteed-visible BEFORE any reconcile fetch settles, per CONTEXT.md D-067-01 verbatim) and UX-067-02 (banner copy is reserved for terminal states only — `streaming` and `completed` show no chrome, mirrors Claude/ChatGPT).

Output: useMessages.ts with audit comment + reordered POST→subscribe handoff + two existence-checked terminal-flip blocks; MessageItem.tsx with the fallback line removed and replaced with `null`.

**Why expand Plan 01 (not split into 01a/01b):** the diff for the BLK-1 architectural cleanup (Task 1) is ~25 LOC (audit comment + 2-line reorder of `subscriptionsRef.current.set` relative to `setMessages` + 1 inline comment explaining the reorder). Combined with Tasks 2-4 (~30 LOC), total stays well under CONTEXT.md's "prefer keep-inline unless diff exceeds ~150 lines" threshold. No split needed. If during execution the audit reveals a deeper restructure is required (e.g., extract to a hook), the executor flags via Rule 3 deviation in the SUMMARY.
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Vibe Apps/Agentic RAG/.planning/PROJECT.md
@C:/Vibe Apps/Agentic RAG/.planning/ROADMAP.md
@C:/Vibe Apps/Agentic RAG/.planning/STATE.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-RESEARCH.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md

<interfaces>
<!-- Key types/exports the executor needs. Extracted from codebase. No exploration required. -->

From `frontend/src/types/index.ts:72-99` (Message — UNCHANGED by this plan):
```typescript
export interface Message {
  id: string
  thread_id: string
  user_id: string
  role: "user" | "assistant"
  content: string
  created_at: string
  updated_at: string
  tool_calls?: ToolCall[]
  iterationCount?: number
  sub_agent?: SubAgentState
  activatedSkill?: string
  activatedSkills?: SkillActivation[]
  sources?: SourceReference[]
  citations?: Citation[]
  confidence?: ConfidenceResult
  suggestions?: string[]
  isPlanning?: boolean
  stopped?: boolean
  runId?: string
  runStatus?: "streaming" | "completed" | "failed" | "cancelled" | "timed_out"
}
```

From `frontend/src/lib/api.ts:165-175` (StreamCallbacks.onTerminal — UNCHANGED):
```typescript
onTerminal: (
  kind: "done" | "error" | "cancelled" | "timed_out",
  errorPayload?: string,
) => void
```

Existing Phase 063.1 guards in `useMessages.ts`:
- `streamingThreadIdRef.current` — set at line 458 (sendMessage), reset to null in finally
- `activeThreadIdRef.current` — written exclusively by `setViewingThread` (Phase 060 D-060-01)
- `messagesRef.current` — synced via useEffect at line 337
- `subscriptionsRef.current.set(run_id, controller)` — Phase 063.1 BL-03; current order: at line 521 (AFTER the runId-stamping setMessages at line 514). Task 1 reorders to fire BEFORE setMessages.
- `subscriptionsRef.current.delete(...)` — Phase 063.1 BL-03; called inside onTerminal BEFORE originalOnTerminal
- `lastSeenOffsetRef.current` — Phase 063.1 D-063.1-09 cursor cache
- `loadMessages(threadId).catch(console.error)` — Phase 063.1 D-063.1-12 buffer_expired fallback

Existing reconcile guards (`useMessages.ts:690-766`):
- `reconcileInFlightRef.current` boolean lock at line 700-701 — set BEFORE Promise.all dispatch
- `Promise.all([getActiveRuns(threadId), loadMessages(threadId)])` at line 706 — parallel fetch
- `messagesRef.current.find((m) => m.runId === run.run_id)` at line 726 — runId-match dedup (D-063.1-04)
- `subscriptionsRef.current.has(run.run_id) continue` at line 761 — short-circuit if a live consumer already subscribed (THIS is the guard sendMessage's reorder makes deterministic against)
- `subscriptionsRef.current.set(run.run_id, controller)` at line 769 — WR-06 fix: reserves slot BEFORE subscribeToRun fires

Existing site of edit — sendMessage POST→subscribe handoff (`useMessages.ts:499-521`, the order matters here):
```typescript
try {
  // Step 1: POST returns synchronously with {message_id, run_id} (D-063-01)
  const { message_id, run_id } = await postMessage(threadId, content, {
    model,
    provider,
    agentMode,
  })
  registeredRunId = run_id

  // WR-04 fix: swap the optimistic user placeholder's temp id for the
  // real persisted user_message UUID returned from POST. Without this,
  // a Realtime upsert that arrives BEFORE the next loadMessages refetch
  // can side-by-side a duplicate persisted user message with the temp
  // placeholder. Also: stamp run_id onto the assistant placeholder so
  // Stop can find it via stopStreaming.
  setMessages((prev) =>
    prev.map((m) => {
      if (m.id === userMsg.id) return { ...m, id: message_id }
      if (m.id === assistantId) return { ...m, runId: run_id }
      return m
    }),
  )
  subscriptionsRef.current.set(run_id, controller)
  // ...
```

Reconcile's mirror site (`useMessages.ts:768-770`) — note WR-06 already does it the right way (set BEFORE subscribeToRun):
```typescript
const controller = new AbortController()
subscriptionsRef.current.set(run.run_id, controller)
```

ChatArea.tsx reconcile triggers (`frontend/src/components/chat/ChatArea.tsx:163-188`):
```tsx
useEffect(() => {
  if (!thread?.id) return
  const tid = thread.id
  reconcileRef.current(tid).catch(console.error)   // Mount

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      reconcileRef.current(tid).catch(console.error)   // Tab visible
    }
  }
  const onFocus = () => reconcileRef.current(tid).catch(console.error)   // Window focus
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) reconcileRef.current(tid).catch(console.error)   // BFCache restore
  }

  document.addEventListener("visibilitychange", onVisibility)
  window.addEventListener("focus", onFocus)
  window.addEventListener("pageshow", onPageShow)

  return () => {
    document.removeEventListener("visibilitychange", onVisibility)
    window.removeEventListener("focus", onFocus)
    window.removeEventListener("pageshow", onPageShow)
  }
}, [thread?.id])
```

These four triggers compete with the sendMessage POST→subscribe handoff. The reconcile-on-mount race scenario (worth-fixing case): user submits a prompt; before the first SSE delta arrives, they Cmd-Tab to another window and back (visibilitychange fires); reconcile starts; reconcile sees the in-flight run_id in `getActiveRuns` AND fires `loadMessages` in parallel. If sendMessage hasn't yet called `subscriptionsRef.current.set(run_id, controller)`, reconcile would not short-circuit at line 761 and would open a duplicate consumer + the parallel `loadMessages` could MERGE the temp placeholder away (Phase 063.1 D-063.1-12 filter is correct but operates on a window where the placeholder hasn't yet been "claimed" by a subscription slot).

`reconcileInFlightRef` (Phase 063.1 D-063.1-11) prevents two concurrent reconciles, but it does NOT prevent the FIRST reconcile from racing the in-flight sendMessage when `subscriptionsRef.current.has(run.run_id)` is checked too early. Task 1 closes this window by moving the subscription slot reservation EARLIER in sendMessage's flow.

Existing site of edit — sendMessage onTerminal override (`useMessages.ts:560-589`, the second `setMessages` in the file at line 568 is UNGUARDED today):
```typescript
const originalOnTerminal = callbacks.onTerminal
callbacks.onTerminal = (kind, errorPayload) => {
  setMessages((prev) =>
    prev.map((m) => {
      if (m.id !== assistantId) return m
      if (kind === "done") return { ...m, runStatus: "completed" }
      if (kind === "error") return { ...m, runStatus: "failed" }
      if (kind === "timed_out") return { ...m, runStatus: "timed_out", stopped: true }
      // kind === "cancelled"
      return { ...m, runStatus: "cancelled", stopped: true }
    }),
  )
  if (registeredRunId) subscriptionsRef.current.delete(registeredRunId)
  if (errorPayload === "buffer_expired") {
    loadMessages(threadId).catch(console.error)
  }
  originalOnTerminal(kind, errorPayload)
}
```

Existing site of edit — reconcile onTerminal override (`useMessages.ts:795-826`, plain `setMessages` at line 807):
```typescript
const originalOnTerminal = callbacks.onTerminal
callbacks.onTerminal = (kind, errorPayload) => {
  setMessages((prev) =>
    prev.map((m) => {
      if (m.id !== targetId) return m
      if (kind === "done") return { ...m, runStatus: "completed" }
      if (kind === "error") return { ...m, runStatus: "failed" }
      if (kind === "timed_out") return { ...m, runStatus: "timed_out" }
      // kind === "cancelled"
      return { ...m, runStatus: "cancelled" }
    }),
  )
  subscriptionsRef.current.delete(run.run_id)
  if (errorPayload === "buffer_expired") {
    loadMessages(threadId).catch(console.error)
  }
  originalOnTerminal(kind, errorPayload)
}
```

Existing site of edit — MessageItem.tsx hasAnyTools branch (line 128-150, fallback at 140):
```tsx
) : hasAnyTools ? (
  <span className="flex items-center gap-2 text-muted-foreground text-sm mt-1.5 animate-fadeSlideUp">
    {isStreaming && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />}
    <span className="italic">
      {isStreaming
        ? (allToolsDone ? "Synthesizing answer" : "Working")
        : message.runStatus === "timed_out"
          ? "Agent reached time limit"
          : message.runStatus === "cancelled" || message.stopped
            ? "Response stopped"
            : "Saving response…"}    {/* ← DELETE THIS LINE — replace with `: null` */}
    </span>
    {isStreaming && (
      <span className="flex gap-1 items-center">
        {/* dots */}
      </span>
    )}
  </span>
) : null}
```

The dual banner at MessageItem.tsx:159-166 is correct and stays untouched (it already keys correctly on `runStatus === "timed_out"` vs `stopped`).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Audit + reorder POST→subscribe handoff (subscription slot BEFORE runId-stamping setMessages) — D-067-01 architectural cleanup</name>
  <files>frontend/src/hooks/useMessages.ts</files>
  <read_first>
    - frontend/src/hooks/useMessages.ts (lines 447-603 — entire sendMessage body covering optimistic insert, POST, runId stamp, subscriptionsRef.set, callbacks build, subscribeToRun call)
    - frontend/src/hooks/useMessages.ts (lines 690-770 — reconcile body covering reconcileInFlightRef, Promise.all, runId-match dedup, subscriptionsRef.has short-circuit, WR-06 set-before-subscribe)
    - frontend/src/components/chat/ChatArea.tsx (lines 155-188 — the four reconcile triggers: mount + visibilitychange + focus + pageshow)
    - .planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md (D-067-01 verbatim — the placeholder + first SSE-attach MUST be guaranteed-visible BEFORE any reconcile fetch settles)
  </read_first>
  <behavior>
    - **Audit (in source comments):** Document the FIVE setMessages call sites in sendMessage's first-paint window with their guard status:
      1. Line 470 — optimistic user message insert. **Exempt by design** — this is the canonical first-write before any subscription exists; nothing to guard against.
      2. Line 486 — optimistic assistant placeholder insert (runStatus="streaming"). **Exempt by design** — same reason; this IS the placeholder that downstream guards protect.
      3. Line 514 — runId stamp on assistant placeholder + user temp-id swap. **Currently unguarded** but only fires AFTER the await on postMessage resolves, so it sits ~50-200ms after the optimistic inserts. Race surface: between THIS setMessages and the subsequent `subscriptionsRef.current.set` at line 521, a competing reconcile (fired by ChatArea visibilitychange/focus/pageshow/mount triggers) could see the in-flight `run_id` in `getActiveRuns` BEFORE `subscriptionsRef.current.has(run.run_id)` returns true — opening a duplicate consumer AND triggering `loadMessages` MERGE in parallel. **Task 1 fix:** reorder so `subscriptionsRef.current.set(run_id, controller)` fires BEFORE this setMessages.
      4. Line 568 (onTerminal override) — terminal-flip. **Currently unguarded; Task 2 fixes** with existence check.
      5. Line 636 (finally) — `isPlanning: false` cleanup. **Exempt by design** — fires regardless of placeholder existence; map is no-op if assistantId already gone.
    - **Reorder:** swap the order of the line-514 setMessages and the line-521 `subscriptionsRef.current.set`. After the reorder, the subscription slot is reserved IMMEDIATELY after `postMessage` returns and BEFORE any state mutation, making `subscriptionsRef.current.has(run_id)` deterministic in any reconcile that races in.
    - **Reconcile-on-mount race fix (no code change required at reconcile site, but documented in audit):** the existing `reconcileInFlightRef` boolean lock + `lastSeenOffsetRef` cursor are correct as-is. The reorder above closes the only remaining race window. Do NOT extend `reconcileInFlightRef` — per BLK-1 anti-pattern flag, extend-not-replace.
    - **Functional outcome:** placeholder + first SSE-attach are guaranteed-visible BEFORE any reconcile fetch settles. The first SSE delta painting from `subscribeToRun` AND the first MERGE-preserve filter pass in any racing `loadMessages` BOTH see a state where the temp placeholder is correctly tagged with `runId`, AND the subscription slot is held — so the placeholder cannot be lost.
  </behavior>
  <action>
    In `frontend/src/hooks/useMessages.ts`, make TWO edits inside the `sendMessage` callback body (lines 499-521).

    **Edit 1 — Insert audit comment block.** Find this exact block (lines 499-505):

    ```typescript
    try {
      // Step 1: POST returns synchronously with {message_id, run_id} (D-063-01)
      const { message_id, run_id } = await postMessage(threadId, content, {
        model,
        provider,
        agentMode,
      })
      registeredRunId = run_id
    ```

    Replace with:

    ```typescript
    try {
      // D-067-01 first-paint setMessages audit (sendMessage POST→subscribe window):
      // Site                              | Line | Guard                         | Rationale
      // -----------------------------------+------+-------------------------------+--------------------------------------------------
      // Optimistic user message insert     | 470  | exempt — pre-subscription     | canonical first-write; nothing yet to guard against
      // Optimistic assistant placeholder   | 486  | exempt — pre-subscription     | placeholder downstream guards protect
      // RunId stamp + user temp-id swap    | 514  | exempt — fires AFTER Edit 2   | subscription slot already held by line 506 (this edit)
      // Terminal-flip onTerminal override  | 568  | guarded by Task 2 existence   | late-fired terminal cannot stomp stale assistantId
      // isPlanning: false finally cleanup  | 636  | exempt — map no-op if absent  | runs regardless; harmless when placeholder gone
      // Reconcile race surface (the worth-fixing case): four ChatArea triggers
      // (mount/visibilitychange/focus/pageshow at ChatArea.tsx:163-188) could
      // fire reconcile BETWEEN postMessage returning and subscriptionsRef.set.
      // Edit 2 below moves the subscription-slot reservation to fire IMMEDIATELY
      // after postMessage resolves — BEFORE the runId-stamping setMessages — so
      // any racing reconcile's `subscriptionsRef.current.has(run.run_id)` check
      // at useMessages.ts:761 short-circuits deterministically. The placeholder
      // + first SSE-attach are then guaranteed-visible BEFORE any reconcile
      // fetch settles (D-067-01 verbatim).
      // Step 1: POST returns synchronously with {message_id, run_id} (D-063-01)
      const { message_id, run_id } = await postMessage(threadId, content, {
        model,
        provider,
        agentMode,
      })
      registeredRunId = run_id
    ```

    **Edit 2 — Reorder subscription slot reservation to fire BEFORE the runId-stamping setMessages.** Find this exact block (lines 514-521 in current source):

    ```typescript
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === userMsg.id) return { ...m, id: message_id }
          if (m.id === assistantId) return { ...m, runId: run_id }
          return m
        }),
      )
      subscriptionsRef.current.set(run_id, controller)
    ```

    Replace with:

    ```typescript
      // D-067-01: reserve subscription slot BEFORE the runId-stamping setMessages
      // so any reconcile racing in via ChatArea's mount/visibilitychange/focus/
      // pageshow triggers (ChatArea.tsx:163-188) finds the slot already held by
      // its `subscriptionsRef.current.has(run.run_id)` short-circuit at line 761
      // and skips the duplicate-consumer + parallel-loadMessages path. This is
      // the SAME ordering pattern reconcile itself uses at line 769 (WR-06 fix:
      // "RESERVE the subscription slot BEFORE firing subscribeToRun").
      subscriptionsRef.current.set(run_id, controller)
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === userMsg.id) return { ...m, id: message_id }
          if (m.id === assistantId) return { ...m, runId: run_id }
          return m
        }),
      )
    ```

    Do NOT touch:
    - The `try { ... } finally { ... }` outer scope.
    - The optimistic user/assistant placeholder inserts at lines 470 and 486 (exempt — canonical first-writes).
    - `streamingThreadIdRef.current = threadId` at line 458 (Phase 063.1 D-063.1-08 — preserve verbatim).
    - The `guardedSetMessages` declaration at lines 544-549 (Phase 063.1 D-063.1-08 — preserve verbatim).
    - The reconcile body at lines 690-766 (Phase 063.1 D-063.1-11 reconcileInFlightRef + WR-06 set-before-subscribe + D-063.1-12 MERGE-preserve filter all stay verbatim — extend-not-replace per BLK-1 anti-pattern flag).
    - `subscribeToRun(run_id, "0", callbacks, controller.signal)` at line 603 (untouched).
    - Any side-effects inside setMessages updaters — none introduced by this task (Phase 057 deferral §1, Phase 060 D-060-11 — React Strict Mode + bail-out optimizations).
  </action>
  <acceptance_criteria>
    - The audit comment is present: `grep -c "D-067-01 first-paint setMessages audit" frontend/src/hooks/useMessages.ts` returns at least 1.
    - All five audit-listed sites are documented in the comment: `grep -c "Optimistic user message insert\\|Optimistic assistant placeholder\\|RunId stamp + user temp-id swap\\|Terminal-flip onTerminal override\\|isPlanning: false finally cleanup" frontend/src/hooks/useMessages.ts` returns at least 5.
    - The reorder is verifiable structurally: extract the order of `subscriptionsRef.current.set(run_id, controller)` and the next `setMessages` after `registeredRunId = run_id` in the sendMessage body. Use this awk gate (filtering out comment lines):

      ```bash
      awk '/registeredRunId = run_id/{flag=1; next} flag && !/^\s*\/\// && /subscriptionsRef\.current\.set\(run_id/{print "set"; flag=0; exit} flag && !/^\s*\/\// && /setMessages\(/{print "setMessages"; flag=0; exit}' frontend/src/hooks/useMessages.ts
      ```

      MUST print `set` (NOT `setMessages`) — confirms `subscriptionsRef.current.set` fires BEFORE the next setMessages call after the postMessage await.
    - Phase 063.1 D-063.1-08 `guardedSetMessages` declaration at lines 544-549 still present: `grep -c "if (streamingThreadIdRef.current !== activeThreadIdRef.current) return" frontend/src/hooks/useMessages.ts` returns at least 1.
    - Phase 063.1 D-063.1-11 `reconcileInFlightRef` declaration intact (extend-not-replace per BLK-1 anti-pattern flag): `grep -c "reconcileInFlightRef" frontend/src/hooks/useMessages.ts` returns at least 3 matches (declaration + top-of-reconcile guard + finally reset).
    - Phase 063.1 D-063.1-09 `lastSeenOffsetRef` declaration intact: `grep -c "lastSeenOffsetRef" frontend/src/hooks/useMessages.ts` returns at least 4 matches.
    - Reconcile's WR-06 set-before-subscribe pattern at line ~769 is byte-identical (this plan does NOT touch reconcile body): `grep -B1 "subscriptionsRef.current.set(run.run_id, controller)" frontend/src/hooks/useMessages.ts | grep -c "const controller = new AbortController()"` returns at least 1.
    - No side-effects introduced inside setMessages updaters: `grep -n "setMessages((prev) => {" frontend/src/hooks/useMessages.ts` shows no NEW arrow bodies vs. prior state (any new ones must be pure return-only — verified by reading the diff).
    - `npx tsc --noEmit -p tsconfig.json` (run from `frontend/`) returns exit 0.
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npx tsc --noEmit -p tsconfig.json && awk '/registeredRunId = run_id/{flag=1; next} flag && !/^\s*\/\// && /subscriptionsRef\.current\.set\(run_id/{print "set"; flag=0; exit} flag && !/^\s*\/\// && /setMessages\(/{print "setMessages"; flag=0; exit}' src/hooks/useMessages.ts | grep -q "^set$"</automated>
  </verify>
  <done>
    Audit comment block documents the five first-paint setMessages sites with guard rationale. `subscriptionsRef.current.set(run_id, controller)` fires BEFORE the runId-stamping setMessages in sendMessage. Reconcile body untouched (WR-06, reconcileInFlightRef, MERGE-preserve filter all preserved verbatim — extend-not-replace per BLK-1 anti-pattern flag). TypeScript compiles. No side-effects inside setMessages updaters.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Guard terminal-flip in sendMessage onTerminal override (existence-check pattern)</name>
  <files>frontend/src/hooks/useMessages.ts</files>
  <read_first>
    - frontend/src/hooks/useMessages.ts (lines 540-589 — sendMessage onTerminal block where the unguarded setMessages lives at line 568)
    - .planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md (Pattern A — verbatim the proposed extension)
  </read_first>
  <behavior>
    - Before edit: `setMessages((prev) => prev.map((m) => { if (m.id !== assistantId) return m; ... }))` at useMessages.ts:568-577 unconditionally maps the array — if the placeholder is gone, the map is a no-op but still allocates a new array.
    - After edit: existence check first; if assistantId not present, return prev unchanged (no array realloc, no React reconcile).
    - Functional outcome unchanged on happy path: terminal still flips runStatus correctly when placeholder exists.
    - Edge case: if reconcile collapsed the placeholder via the temp- → DB-row swap (Phase 063.1 D-063.1-12), the terminal flip is a no-op AND the next reconcile will pick up correct DB-row runStatus via Phase 063.1 D-063.1-13/15 LEFT JOIN.
  </behavior>
  <action>
    In `frontend/src/hooks/useMessages.ts` at lines 568-577 (the sendMessage onTerminal `setMessages` block), wrap the existing map in an existence-check guard. Replace this code:

    ```typescript
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== assistantId) return m
        if (kind === "done") return { ...m, runStatus: "completed" }
        if (kind === "error") return { ...m, runStatus: "failed" }
        if (kind === "timed_out") return { ...m, runStatus: "timed_out", stopped: true }
        // kind === "cancelled"
        return { ...m, runStatus: "cancelled", stopped: true }
      }),
    )
    ```

    with this code (per D-067-02 / RESEARCH "Pattern A" / PATTERNS.md lines 73-83):

    ```typescript
    // D-067-02: existence-check guard. If a thread switch + reconcile (Phase
    // 063.1 D-063.1-12 MERGE-preserve filter or DB-row swap via D-063.1-04
    // runId-match dedup) collapsed the placeholder identified by `assistantId`,
    // the terminal flip is a no-op AND the next reconcile picks up the
    // correct DB-row runStatus via Phase 063.1 D-063.1-13/15 LEFT JOIN.
    // Avoids the unguarded setMessages race documented in 067-RESEARCH.md
    // §"useMessages.ts state-machine cleanup".
    setMessages((prev) => {
      if (!prev.some((m) => m.id === assistantId)) return prev
      return prev.map((m) => {
        if (m.id !== assistantId) return m
        if (kind === "done") return { ...m, runStatus: "completed" }
        if (kind === "error") return { ...m, runStatus: "failed" }
        if (kind === "timed_out") return { ...m, runStatus: "timed_out", stopped: true }
        // kind === "cancelled"
        return { ...m, runStatus: "cancelled", stopped: true }
      })
    })
    ```

    Do NOT touch:
    - The `subscriptionsRef.current.delete(registeredRunId)` line (BL-03 cleanup ordering — preserve verbatim).
    - The `loadMessages(threadId).catch(console.error)` buffer_expired fallback (Phase 063.1 D-063.1-12 — preserve verbatim).
    - The `originalOnTerminal(kind, errorPayload)` invocation order (always last, after subscriptions cleanup).
    - The `guardedSetMessages` declaration at lines 544-549 (Phase 063.1 D-063.1-08 — preserve verbatim, this plan does NOT extend `guardedSetMessages`; it adds an orthogonal existence check inside the terminal-specific override).
  </action>
  <acceptance_criteria>
    - `grep -c "prev.some((m) => m.id === assistantId)" frontend/src/hooks/useMessages.ts` returns at least 1 in the sendMessage onTerminal block (line ~568-580).
    - `grep -v '^[[:space:]]*//' frontend/src/hooks/useMessages.ts | grep -c "Saving response"` returns `0` (no fallback string introduced — this is a state-machine guard, not a UI string; comment lines stripped before count per Nyquist gate hygiene).
    - Phase 063.1 D-063.1-08 `guardedSetMessages` declaration at lines 544-549 still present: `grep -c "if (streamingThreadIdRef.current !== activeThreadIdRef.current) return" frontend/src/hooks/useMessages.ts` returns at least 1.
    - Phase 063.1 BL-03 cleanup ordering preserved: `subscriptionsRef.current.delete(registeredRunId)` STILL appears BEFORE `originalOnTerminal(kind, errorPayload)` in the sendMessage onTerminal block — verify by reading lines 580-595 after edit.
    - `npx tsc --noEmit -p tsconfig.json` (run from `frontend/`) returns exit 0.
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>
    sendMessage's onTerminal setMessages updater wraps its map in `prev.some((m) => m.id === assistantId) ? prev.map(...) : prev`. TypeScript compiles. Phase 063.1 guards (guardedSetMessages, BL-03 ordering, buffer_expired fallback) preserved verbatim.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Guard terminal-flip in reconcile onTerminal override (existence-check pattern, mirrored)</name>
  <files>frontend/src/hooks/useMessages.ts</files>
  <read_first>
    - frontend/src/hooks/useMessages.ts (lines 779-826 — reconcile guardedSetMessages declaration + onTerminal block)
    - .planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md (Pattern A — same shape, target id is `targetId` not `assistantId`)
  </read_first>
  <behavior>
    - Mirror of Task 2 in the reconcile path. The reconcile path uses `targetId` (the dedup-resolved id from D-063.1-04) instead of `assistantId`.
    - Note: reconcile path does NOT set `stopped: true` on cancelled/timed_out (intentional asymmetry — reconcile re-attaches to a possibly-not-yet-stopped run). Preserve this asymmetry verbatim.
  </behavior>
  <action>
    In `frontend/src/hooks/useMessages.ts` at lines 807-816 (the reconcile onTerminal `setMessages` block), wrap the existing map in an existence-check guard. Replace this code:

    ```typescript
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== targetId) return m
        if (kind === "done") return { ...m, runStatus: "completed" }
        if (kind === "error") return { ...m, runStatus: "failed" }
        if (kind === "timed_out") return { ...m, runStatus: "timed_out" }
        // kind === "cancelled"
        return { ...m, runStatus: "cancelled" }
      }),
    )
    ```

    with this code (per D-067-02 / mirrors Task 2):

    ```typescript
    // D-067-02: existence-check guard, mirrors sendMessage's terminal flip.
    // If loadMessages's MERGE-preserve filter (Phase 063.1 D-063.1-12) dropped
    // the placeholder because the DB row caught up, the flip is a no-op and
    // the next reconcile picks up the DB-row runStatus via D-063.1-13/15.
    setMessages((prev) => {
      if (!prev.some((m) => m.id === targetId)) return prev
      return prev.map((m) => {
        if (m.id !== targetId) return m
        if (kind === "done") return { ...m, runStatus: "completed" }
        if (kind === "error") return { ...m, runStatus: "failed" }
        if (kind === "timed_out") return { ...m, runStatus: "timed_out" }
        // kind === "cancelled"
        return { ...m, runStatus: "cancelled" }
      })
    })
    ```

    Preserve verbatim:
    - The `guardedSetMessages` thread-match closure at lines 779-784 (Phase 063.1 D-063.1-08).
    - `subscriptionsRef.current.delete(run.run_id)` BEFORE `originalOnTerminal(kind, errorPayload)` (BL-03).
    - The asymmetric NO `stopped: true` on cancelled/timed_out branches (different from sendMessage — reconcile attaches mid-run; do NOT add it).
    - `lastSeenOffsetRef.current.set(run.run_id, msId)` cursor advancement at line 834-836 (Phase 063.1 D-063.1-09).
    - `reconcileInFlightRef` boolean lock pattern (Phase 063.1 D-063.1-11) — already encloses this entire block; do NOT touch the outer try/finally that resets it.
    - The for-loop body in reconcile MUST remain byte-identical to current state EXCEPT for the existence-check wrap of these 9 lines (Pitfall 1 from RESEARCH lines 432-440).
  </action>
  <acceptance_criteria>
    - `grep -c "prev.some((m) => m.id === targetId)" frontend/src/hooks/useMessages.ts` returns at least 1 in the reconcile onTerminal block (line ~807-820).
    - Asymmetry preserved — `grep -A1 'kind === "cancelled"' frontend/src/hooks/useMessages.ts` shows `runStatus: "cancelled", stopped: true` (sendMessage path) AND a separate occurrence with just `runStatus: "cancelled"` (no `stopped: true` — reconcile path).
    - Phase 063.1 D-063.1-11 `reconcileInFlightRef` declaration intact: `grep -c "reconcileInFlightRef" frontend/src/hooks/useMessages.ts` returns at least 3 matches (declaration + top-of-reconcile guard + finally reset).
    - Phase 063.1 D-063.1-09 `lastSeenOffsetRef.current.set(run.run_id, msId)` cursor advance still present in the reconcile block: `grep -c "lastSeenOffsetRef.current.set(run.run_id" frontend/src/hooks/useMessages.ts` returns at least 1.
    - Reconcile for-loop body stays byte-identical (Pitfall 1): `git diff frontend/src/hooks/useMessages.ts | grep -c "^+" | grep -v "^++"` should not exceed ~15 added lines for this specific edit (the existence check + comment ~7-8 added lines net).
    - `npx tsc --noEmit -p tsconfig.json` (run from `frontend/`) returns exit 0.
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>
    reconcile's onTerminal setMessages updater wraps its map in `prev.some((m) => m.id === targetId) ? prev.map(...) : prev`. TypeScript compiles. Reconcile's asymmetric no-stopped behavior preserved. lastSeenOffsetRef cursor advancement intact. reconcileInFlightRef lock pattern intact.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Delete "Saving response…" fallback in MessageItem.tsx</name>
  <files>frontend/src/components/chat/MessageItem.tsx</files>
  <read_first>
    - frontend/src/components/chat/MessageItem.tsx (lines 128-166 — banner switch in hasAnyTools branch + dual banner block)
    - .planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md (lines 167-198 — exact before/after diff)
  </read_first>
  <behavior>
    - Before: when `!isStreaming && hasAnyTools && runStatus is not timed_out/cancelled && !stopped`, the `<span className="italic">` displays "Saving response…".
    - After: when no terminal state matches, the `<span className="italic">` renders `null` (no text). Banner copy is reserved for terminal states only (D-067-02).
    - Side effect: between SSE stream-end and Postgres persistence (a brief window — typically <1s), the inner `italic` span will be empty. The bouncing-dots `<span>` at lines 142-148 is gated on `isStreaming` and will already be hidden by the time we reach this fallback (because we're in `!isStreaming` branch). No orphaned dots.
  </behavior>
  <action>
    In `frontend/src/components/chat/MessageItem.tsx` at line 134-141 (the inner ternary chain inside `<span className="italic">`), change the final fallback from `: "Saving response…"` to `: null`. Specifically:

    Find this block (line 134-141):
    ```tsx
    {isStreaming
      ? (allToolsDone ? "Synthesizing answer" : "Working")
      : message.runStatus === "timed_out"
        ? "Agent reached time limit"   /* Phase 066 D-066-10 — system per-LLM-call deadline fired */
        : message.runStatus === "cancelled" || message.stopped
          ? "Response stopped"          /* user clicked Stop (D-066-10); stopped fallback for legacy pre-runStatus rows */
          : "Saving response…"}
    ```

    Replace with:
    ```tsx
    {isStreaming
      ? (allToolsDone ? "Synthesizing answer" : "Working")
      : message.runStatus === "timed_out"
        ? "Agent reached time limit"   /* Phase 066 D-066-10 — system per-LLM-call deadline fired */
        : message.runStatus === "cancelled" || message.stopped
          ? "Response stopped"          /* user clicked Stop (D-066-10); stopped fallback for legacy pre-runStatus rows */
          : null /* D-067-02: no mid-stream chrome — terminal states only carry text. Match Claude/ChatGPT. */}
    ```

    Do NOT touch:
    - The dual banner at lines 159-166 (`{(message.stopped || message.runStatus === "timed_out") && !isStreaming && (...)}`) — already correctly keys on terminal state, no fallback there.
    - The Resume button gating at lines 104-115 (Phase 066 D-066-09 — `failed || timed_out`).
    - The Thinking fallback at line 121 (`isStreaming && !hasAnyTools` branch) — that fires BEFORE any tool runs, no terminal state involved.
    - The bouncing-dots `<span>` at lines 142-148 — already gated on `isStreaming`, fine to leave.

    Verify after edit (Pitfall 3 audit gate from PATTERNS.md line 196-198): `grep -rn "Saving response" frontend/src/` returns 0 across the entire frontend tree (excluding any comment-only matches; pure code search).
  </action>
  <acceptance_criteria>
    - `grep -rn "Saving response" frontend/src/` returns 0 matches (the literal string is gone from the entire frontend source tree).
    - The `: null` fallback is present in MessageItem.tsx at the same approximate line (was 140, now ~140-141 with comment): `grep -c "D-067-02: no mid-stream chrome" frontend/src/components/chat/MessageItem.tsx` returns at least 1.
    - Dual banner at lines 159-166 untouched: `grep -c "Agent reached time limit" frontend/src/components/chat/MessageItem.tsx` returns 2 matches (one in the inner ternary, one in the dual banner span at line 163).
    - Resume button gating preserved: `grep -c 'message.runStatus === "failed" || message.runStatus === "timed_out"' frontend/src/components/chat/MessageItem.tsx` returns at least 1.
    - `npx tsc --noEmit -p tsconfig.json` (run from `frontend/`) returns exit 0.
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npx tsc --noEmit -p tsconfig.json && if grep -rqn "Saving response" frontend/src/; then echo "FAIL: Saving response still present"; exit 1; else echo "OK: no Saving response in frontend/src"; fi</automated>
  </verify>
  <done>
    "Saving response…" literal absent from the entire frontend source tree. Banner copy reserved for terminal states only (`timed_out` → "Agent reached time limit"; `cancelled || stopped` → "Response stopped"). Dual banner block (lines 159-166) and Resume button (lines 104-115) untouched. TypeScript compiles.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → React state | All edits in this plan live entirely inside the React state-machine (useMessages.ts hook + MessageItem.tsx render). No new network surface, no new IPC. |
| SSE event payload → setMessages updater | Existing trust boundary unchanged — `kind` is one of 4 enum values from api.ts:165-175 narrow union. |
| postMessage POST response → subscriptionsRef Map | Existing trust boundary; the `run_id` returned by POST is the same one persisted to `runs.run_id` in the backend. Reordering its use does not change the trust boundary. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-067-01-01 | Tampering | useMessages.ts terminal-flip | accept | No new tampering surface; the existence check is a pure-React state guard. Existing thread-id guards (`guardedSetMessages` Phase 063.1 D-063.1-08) still in place — adding the existence check in front does NOT relax any existing security invariant. |
| T-067-01-02 | Information disclosure | MessageItem.tsx banner copy | accept | The deleted "Saving response…" string was never sensitive. No PII surface. |
| T-067-01-03 | Denial of Service | Concurrent setMessages in StrictMode | mitigate | The existence check prevents wasted React reconciliation work when the placeholder is gone — STRICTLY a quality improvement; cannot regress DoS posture. |
| T-067-01-04 | Tampering | sendMessage POST→subscribe handoff race | mitigate | The reorder of `subscriptionsRef.current.set(run_id, controller)` to fire BEFORE the runId-stamping setMessages closes a window where a competing reconcile could open a duplicate consumer for the same run_id. Without the reorder, two consumers reading from the same Redis Stream offset would not corrupt state (idempotent on the React side via D-063.1-04) but would waste a Redis BLOCK slot. With the reorder, the duplicate-consumer path is closed by `subscriptionsRef.current.has(run.run_id)` at line 761. |

No new authn/authz, no new external network egress, no new user-input parsing. Threat surface is bounded to existing browser-local React state.
</threat_model>

<verification>
Phase-wide checks for this plan (per D-067-07, deferred to Plan 05 for live UAT):
- TypeScript build green: `cd frontend && npx tsc --noEmit -p tsconfig.json` exits 0.
- Pitfall 3 audit gate: `grep -rn "Saving response" frontend/src/` returns 0 matches.
- D-067-01 audit comment present and complete (5 sites listed).
- D-067-01 reorder verifiable via the awk gate in Task 1's verify (subscriptionsRef.set fires before next setMessages after postMessage await).
- Phase 063.1 D-063.1-08/D-063.1-09/D-063.1-11/D-063.1-12 guard signatures still present (greps above).
- Phase 063.1 BL-03 cleanup ordering still present in BOTH terminal-flip blocks.

Live verification (D-067-07 — moved to Plan 05 closing UAT, but a partial smoke is recommended after this plan commits):
- Chrome MCP: open http://localhost:5173/ as fhdmrd@gmail.com / 123456; submit a short prompt; observe placeholder paints within 1s, no "Saving response…" text appears at any point in the cycle, terminal banner copy correct on completion. The first-paint guarantee from Task 1's reorder is also empirically verifiable: open Chrome DevTools Network tab while submitting; the `EventStream` request to `/runs/{run_id}/stream?since=0` should appear immediately after the POST `/threads/{tid}/messages` returns 200, with NO duplicate `EventStream` request for the same run_id even if the user Cmd-Tabs during the handoff window. Captured fully in Plan 05 evidence; partial smoke acceptable here as a sanity check.
</verification>

<success_criteria>
- D-067-01 audit comment block in source documents the five first-paint setMessages sites with guard rationale.
- `subscriptionsRef.current.set(run_id, controller)` fires BEFORE the runId-stamping setMessages in sendMessage's POST→subscribe handoff.
- Both terminal-flip setMessages updaters wrap their map in `prev.some((m) => m.id === <id>) ? prev.map(...) : prev`.
- "Saving response…" literal absent from `frontend/src/`.
- TypeScript compiles green.
- All Phase 063.1 guards (guardedSetMessages, reconcileInFlightRef, BL-03 ordering, MERGE-preserve filter, lastSeenOffsetRef cursor) preserved verbatim — extend-not-replace per BLK-1 anti-pattern flag.
- Reconcile for-loop body stays byte-identical except for the targeted existence-check wrap (Pitfall 1).
- No side-effects introduced inside setMessages updaters (Phase 057 deferral §1 / Phase 060 D-060-11).
- No new dependencies, no new env vars, no migrations.
</success_criteria>

<output>
After completion, create `.planning/phases/067-frontend-streaming-ux-fix/067-01-SUMMARY.md` documenting:
- Task 1: audit comment block placement (line cited); reorder of subscriptionsRef.set / setMessages (before/after line numbers cited).
- Task 2 + Task 3: both onTerminal blocks now existence-checked (line numbers cited).
- Task 4: "Saving response…" deleted from MessageItem.tsx (line cited).
- TypeScript build result.
- Any deviations from the plan (with rationale per Rule 3 of execute-plan.md). Especially: if during Task 1 audit the executor finds that the diff exceeds ~150 LOC, document the split decision (would need a follow-up plan) — but expect the diff to stay well under that threshold given the scoped reorder.
- Live-UAT smoke if executed (deferred to Plan 05 by default).
</output>
</content>
</invoke>