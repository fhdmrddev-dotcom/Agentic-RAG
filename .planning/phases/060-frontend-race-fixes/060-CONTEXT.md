# Phase 060: Frontend Race Fixes - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Switching from a streaming Thread A to Thread B always renders Thread B's correct messages, with no cross-thread data leak and no raw tool-result JSON regression. Scope is the React side of the v2.5 frontend stack — `frontend/src/hooks/useMessages.ts`, `frontend/src/components/chat/ChatArea.tsx`, and the `getMessages` signature in `frontend/src/lib/api.ts`. Backend SSE behaviour is unchanged from Phase 059.

**In scope:**
- New `setViewingThread(threadId)` callback exported from `useMessages` — the **only** writer of `activeThreadIdRef` (D-060-01).
- `loadMessages` accepts `AbortSignal` and reads `activeThreadIdRef` only post-await (D-060-02). A new `loadAbortRef` cancels the previous in-flight `getMessages` fetch when a fresh `loadMessages` runs (D-060-03).
- `getMessages(threadId, signal?: AbortSignal)` — optional second arg threaded through `fetch` (D-060-04).
- Removal of the `loadMessages(threadId)` call inside `sendMessage`'s `finally` block (D-060-05) — the streaming-format messages built up by SSE deltas remain authoritative; the Bug 3 raw-JSON regression no longer recurs.
- ChatArea `useEffect([thread?.id])` reordered to `setViewingThread → abortStream → clearMessages → loadMessages` (D-060-08), dep array reduced to `[thread?.id]` only (D-060-09).
- `clearMessages` no longer calls `abortControllerRef.abort()` — caller (ChatArea) aborts explicitly via `abortStream()` first (D-060-10).
- AbortError silenced inside `loadMessages` (D-060-11) so call-site `.catch(console.error)` only sees real errors.
- Aggressive Phase 057 band-aid removal: `subscribeToThread`/`unsubscribeFromThread`/`threadChannelRef`, the per-stream `channelRef` Realtime sub inside `sendMessage`, the 8-second fallback timer in ChatArea, and the `visibilitychange` listener in ChatArea — all deleted (D-060-06, D-060-07). Phase 061 reintroduces tab-switch + F5 recovery via the proper polling/`visibilitychange` mechanism.
- Browser MCP test exercising the Thread A→B navigation race, with Network-tab evidence that Thread A's `getMessages` was aborted (D-060-12).

**Out of scope (belongs to other phases):**
- Tab-switch (Symptom E) and F5 mid-stream (Symptom F) recovery — Phase 061.
- Reusable browser-MCP scenario harness covering E/F/G/H + navigate-during-stream — Phase 062.
- Skill-test infrastructure repair (`create_streaming_chat` patch breakage) — Phase 063.
- Reintroduction of Realtime as a low-latency hint layer (STREAM-03) — deferred to a later milestone.
- Resume button UX for backend-mid-generation case — Phase 061.

</domain>

<decisions>
## Implementation Decisions

### Race-fix core (the three SC items)

- **D-060-01 — `setViewingThread` is the sole writer of `activeThreadIdRef`.** New callback exported from `useMessages`. Implementation:
  ```ts
  const setViewingThread = useCallback((threadId: string | null) => {
    activeThreadIdRef.current = threadId
  }, [])
  ```
  Called from `ChatArea`'s `useEffect([thread?.id])` as the **first** statement, before `abortStream`/`clearMessages`/`loadMessages`. `loadMessages` and any other code path that previously assigned to `activeThreadIdRef.current` must stop doing so. Concrete deletions: line 99 of useMessages.ts (`activeThreadIdRef.current = threadId` at the top of `loadMessages`).

- **D-060-02 — `loadMessages` reads `activeThreadIdRef` only post-await.**
  ```ts
  const loadMessages = useCallback(async (threadId: string) => {
    loadAbortRef.current?.abort()
    const controller = new AbortController()
    loadAbortRef.current = controller
    try {
      const data = await getMessages(threadId, controller.signal)
      if (activeThreadIdRef.current !== threadId) return    // discard cross-thread response
      if (isSendingRef.current) return                       // protect optimistic placeholders
      setMessages(data)
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      throw err
    }
  }, [])
  ```
  Discarding cross-thread responses is mandatory — concurrent calls would otherwise corrupt each other (the actual bug found in v2.5-dev — see 057-DEFERRAL.md §"loadMessages was overwriting its own guard").

- **D-060-03 — `loadAbortRef: useRef<AbortController | null>(null)` cancels the previous in-flight fetch.** Each new `loadMessages(threadId)` calls `loadAbortRef.current?.abort()` first, then installs a fresh `AbortController` and threads its `.signal` into `getMessages`. The aborted fetch surfaces an `AbortError` that the catch in D-060-02 silently swallows (D-060-11).

- **D-060-04 — `getMessages(threadId, signal?: AbortSignal)`.** Optional second parameter. Existing callers without a signal continue to work unchanged; only `loadMessages` passes one. Implementation in `frontend/src/lib/api.ts` adds `signal` to the existing `fetch(...)` options.

- **D-060-05 — Drop the `loadMessages` call from `sendMessage`'s `finally` block** (currently lines 495-497 of useMessages.ts). The streaming-format messages built up by SSE deltas are authoritative. Reload on natural completion is the source of the Bug 3 raw-JSON regression and is no longer needed once Realtime subscriptions are also removed (D-060-06, D-060-07).

### Aggressive Phase 057 cleanup

The user explicitly chose to drop ALL FOUR band-aids. Phase 061 will reintroduce E/F recovery via the proper polling/visibilitychange mechanism on a clean foundation.

- **D-060-06 — Delete the per-stream `channelRef` Realtime subscription** (useMessages.ts:32, 156-200, and the teardown logic at 437-444). Its only purpose was to recover messages after SSE drop — that responsibility moves to Phase 061. With the `finally`-block reload also gone, `channelRef` has no remaining role. Removes `supabase.channel("messages-thread-${threadId}")`, the `.on("postgres_changes", ...)` callback, and the `setTimeout(..., navigatedAway ? 0 : 2000)` teardown dance.

- **D-060-07 — Delete `subscribeToThread`/`unsubscribeFromThread`/`threadChannelRef`** (useMessages.ts:33, 55-96). The always-on Realtime channel was a 057 attempt at recovery; 057-DEFERRAL.md §"Two Realtime subscriptions for the same thread exist simultaneously" explicitly identifies this as a race source. Removes the exported `subscribeToThread`/`unsubscribeFromThread` from the `UseMessages` interface — `ChatArea` is the only consumer (verified) and both calls are deleted in D-060-09.

- **D-060-07b — Delete the 8-second fallback timer in `ChatArea` `useEffect`** (ChatArea.tsx:90-92, plus the `clearTimeout(fallbackTimer)` at line 105). Phase 061's polling replaces it.

- **D-060-07c — Delete the `visibilitychange` listener in `ChatArea` `useEffect`** (ChatArea.tsx:96-101, plus the `removeEventListener` at line 106). Phase 061's proper handler replaces it.

- **Short-term regression note (acceptable):** Symptoms E and F will not recover automatically between 060 landing and 061 landing — the user must navigate away and back to refresh. This is documented and acceptable because (a) the previous mechanisms didn't reliably work either (see 057-DEFERRAL evidence), (b) Phase 061 is the next phase in the milestone, and (c) the goal of 060 is a clean foundation, not a partially-fixed E/F.

### ChatArea wiring

- **D-060-08 — `useEffect` body executes `setViewingThread → abortStream → clearMessages → loadMessages` in that exact order**, mirroring 057-DEFERRAL FIX 4. Concretely:
  ```ts
  useEffect(() => {
    setViewingThread(thread?.id ?? null)
    if (!thread) {
      clearMessages()
      return
    }
    if (justCreatedThreadRef.current === thread.id) {
      justCreatedThreadRef.current = null
      return
    }
    abortStream()
    clearMessages()
    loadMessages(thread.id).catch(console.error)
  }, [thread?.id])
  ```
  The `setViewingThread` call must run BEFORE `clearMessages` because `clearMessages` no longer aborts (D-060-10) and we need the ref pointing at the new thread before any concurrent `loadMessages` resolution checks it.

- **D-060-09 — `useEffect` dep array is `[thread?.id]` only.** Justification: `setViewingThread`, `abortStream`, `clearMessages`, `loadMessages` are all `useCallback`s with `[]` deps in `useMessages` and therefore have stable identity across renders. Including them is defensive noise that risks effect re-fires if their dep arrays ever change inadvertently. ESLint `react-hooks/exhaustive-deps` will warn — suppress with a clearly-justified `// eslint-disable-next-line react-hooks/exhaustive-deps` comment, or hoist the callbacks into a stable container (planner picks). Same-thread re-renders do not re-fire because the effect dep is the thread id, not the thread object.

- **D-060-10 — `clearMessages` no longer calls `abortControllerRef.abort()`.** Concrete change: delete `abortControllerRef.current?.abort()` and `abortControllerRef.current = null` at lines 50-51 of useMessages.ts. The caller (ChatArea) is responsible for calling `abortStream()` first when it intends to abort. The `setMessages([]) / setIsStreaming(false) / isSendingRef.current = false` assignments stay.

### Error handling

- **D-060-11 — AbortError silenced inside `loadMessages`.** `try/catch` returns silently when `err.name === "AbortError"`; rethrows everything else. Call sites keep `.catch(console.error)` and only see real errors. Mirrors the existing pattern at useMessages.ts:423 inside `sendMessage`'s catch.

### Verification

- **D-060-12 — Inline chrome-mcp test for SC#4** at `tests/browser/060-thread-race.test.{ts,js}` (planner picks the file extension based on existing test infra). The test:
  1. Opens the dev frontend in a controlled chrome MCP session.
  2. Logs in as a test user, opens Thread A and starts a long-running stream (use a multi-tool prompt — e.g. "List 20 documents and summarize each"; planner picks a deterministic prompt that gives at least 5 seconds of streaming).
  3. While streaming, clicks Thread B in the sidebar.
  4. Asserts that Thread B's message list contains only Thread B's messages (no Thread A leak), and that the Network panel records Thread A's `getMessages` request as `aborted`.
  5. Asserts that no raw tool-result JSON appears in the chat content (regression guard for Bug 3).
  Re-used by Phase 062 — when 062 builds the harness, it imports this test file or refactors it into the harness format. **Not** a merge gate for Phase 062's harness; Phase 062 generalizes the pattern, this scenario stays.

- **D-060-13 — Manual two-tab DevTools checklist in `060-VERIFICATION.md`** mirrors the 058/059 format as a backstop for human reviewers. Non-gating; the chrome-mcp test in D-060-12 is the gating evidence.

### Claude's Discretion

- Exact prompt for the long-running stream in the chrome-mcp test (must yield ≥5s of streaming deterministically).
- Whether `loadMessages`'s same-thread `isSendingRef.current` guard at line 110 is preserved (defensive — keeps optimistic placeholders from being wiped if Phase 061 calls `loadMessages` while a send is in flight) or simplified (no caller currently re-enters `loadMessages` mid-send after D-060-05). Keeping it is the safer default.
- Whether legacy guards `streamingThreadIdRef` (line 31) and `sendGenerationRef` (line 28) are deleted now or left for a future cleanup. They were defending against streaming-time races that the new `setViewingThread` + `AbortController` pattern subsumes; deletion is safe but not strictly required by Phase 060 SC. Planner can delete cleanly if the diff stays focused.
- Where `loadAbortRef` lives in the hook body (top-level ref alongside `abortControllerRef`, or grouped with other refs). Pure ergonomics.
- Test file location and harness — `tests/browser/`, `frontend/tests/e2e/`, or wherever existing browser-MCP precedent lives (planner runs `ls` first; if no precedent, create `tests/browser/`).
- Whether the ESLint suppression for the reduced dep array is `// eslint-disable-next-line react-hooks/exhaustive-deps` inline or a justification comment block (style-only).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level decisions and milestone scope
- `.planning/PROJECT.md` — Key Decisions, esp. D-v2.5-03 (Realtime is best-effort, reconcile via fetch is source of truth) and the 057 deferral note in the Key Decisions table.
- `.planning/REQUIREMENTS.md` — **STREAM-02a** is the locked acceptance criterion for this phase (verified by: start streaming on Thread A → click Thread B before stream ends → confirm Thread B shows only Thread B's messages, no leak from A). **Locked.**
- `.planning/ROADMAP.md` — Phase 060 Success Criteria 1–4 are the binding behavioural contract; Risks/pitfalls section reproduces the structural constraints.

### Prior-attempt context (HIGH PRIORITY — read in full)
- `.planning/milestones/v2.4-phases/057-sse-realtime-reconnect-fix/057-DEFERRAL.md` — Two prior failed attempts. **§"What Was Discovered During Browser Testing" (subsections 1, 2, 3)** is the canonical bug catalogue. **§"Updated Recommended Approach" Steps 1, 2, 5** are the FIX 1, FIX 2/4, and Cancel-on-Navigate sketches that 060 implements. The "Why The v2.5-dev Attempt Was Reverted" section explains why iterating without browser feedback failed — Phase 060 must avoid that failure mode (D-060-12 inline chrome-mcp test).
- `.planning/milestones/v2.4-phases/055-streaming-reliability-connection-resilience/055-DEFERRAL.md` — referenced by 057-DEFERRAL for Realtime delivery context (skim only).

### Phase 058/059 hand-off
- `.planning/phases/058-backend-sse-concurrency-fix/058-CONTEXT.md` — D-058-02 (pre-stream INSERT scope) and D-058-07 (AnyIO 200-token limiter) — backend-side context that explains why frontend can rely on `getMessages` returning <1s during a stream.
- `.planning/phases/059-sse-architecture-refactor/059-CONTEXT.md` — D-059-02 (unified `task.cancel()` is the only cancel signal) and D-059-03 (Stop is purely client-side `AbortController`) — explains why frontend `AbortController.abort()` reliably tears down the backend stream now (it didn't before 058+059 shipped). The frontend wire format is **unchanged** from 059 (D-059-04 §"No structured event-name routing for this phase").
- `.planning/phases/059-sse-architecture-refactor/059-VERIFICATION.md` — verification format precedent for `060-VERIFICATION.md`.

### Codebase landmarks (concrete edit sites)
- `frontend/src/hooks/useMessages.ts:35` — `activeThreadIdRef` declaration (kept).
- `frontend/src/hooks/useMessages.ts:99` — `activeThreadIdRef.current = threadId` inside `loadMessages` — **deleted** in 060 (D-060-01 makes `setViewingThread` the sole writer).
- `frontend/src/hooks/useMessages.ts:33, 55-96` — `threadChannelRef`, `subscribeToThread`, `unsubscribeFromThread` — **deleted** in 060 (D-060-07).
- `frontend/src/hooks/useMessages.ts:32, 156-200, 437-444` — per-stream `channelRef` and its teardown dance — **deleted** in 060 (D-060-06).
- `frontend/src/hooks/useMessages.ts:50-51` — `abortControllerRef.current?.abort()` inside `clearMessages` — **deleted** in 060 (D-060-10).
- `frontend/src/hooks/useMessages.ts:495-497` — `loadMessages(threadId)` inside `sendMessage`'s `finally` block — **deleted** in 060 (D-060-05).
- `frontend/src/hooks/useMessages.ts:98-114` — `loadMessages` body — rewritten per D-060-02/03/11.
- `frontend/src/components/chat/ChatArea.tsx:68-108` — main thread-selection `useEffect` — rewritten per D-060-08/09.
- `frontend/src/components/chat/ChatArea.tsx:90-92, 96-101, 105-106` — 8s fallback timer + visibilitychange listener — **deleted** in 060 (D-060-07b/c).
- `frontend/src/lib/api.ts:48-72` — `getMessages` signature — `signal?: AbortSignal` parameter added (D-060-04).

### Codebase intelligence
- `.planning/codebase/STRUCTURE.md` — frontend layout reference; useMessages.ts and ChatArea.tsx are the canonical chat pair.
- `.planning/codebase/CONVENTIONS.md` — TypeScript / React conventions (useCallback `[]` deps for stable identity is established pattern across hooks).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AbortController` is already wired through `streamMessage`** (useMessages.ts:419) — adding it to `getMessages` follows the same Web standard pattern; no new abstractions needed.
- **`useCallback([])` for stable callback identity** is the established pattern across `useMessages` (every existing callback uses this). `setViewingThread`, the rewritten `loadMessages`, and the cleaned-up `clearMessages` all follow it.
- **AbortError-swallow pattern** already exists at useMessages.ts:423 inside `sendMessage`'s catch — the exact same idiom is the basis for D-060-11.
- **ChatArea's `justCreatedThreadRef` shortcut** (ChatArea.tsx:34, 77-80) already handles the "thread was just created and is mid-send" edge case correctly; D-060-08 preserves it verbatim.

### Established Patterns
- All Supabase reads in the SSE/chat path are already async via `aexec` on the backend (D-058-03) — the frontend GET is unaffected by the backend changes from 058+059 except that it now returns <1s during streaming (CONCUR-01) and the SSE stream cancels cleanly on `AbortController.abort()` (CONCUR-02). Phase 060 leans on both guarantees.
- The `Message` type's `tool_calls` field is the streaming-format projection (live SSE-built); the DB version stores tool execution context inside `content` (the source of Bug 3). 060 keeps the streaming version authoritative by removing the `finally`-block reload (D-060-05). Future reload paths (Phase 061) must either (a) project the DB row back to the streaming format before applying or (b) only reload from a genuine reconnect entry-point.
- React Strict Mode double-invokes `useEffect`s and `useState` updaters in dev — the existing code already accounts for this (e.g., ref-guarded `justCreatedThreadRef`). 060's reduced dep array doesn't change Strict Mode behaviour.

### Integration Points
- **Frontend ↔ backend wire format is unchanged** from 059. Every SSE event still arrives as `data: {"type": "...", ...}`; `streamMessage` parser doesn't need any changes for 060.
- **Backend `getMessages` (`GET /threads/{id}/messages`) already supports request abort** at the FastAPI/Starlette level — `AbortController.abort()` triggers a TCP RST that surfaces as `http.disconnect` server-side. Backend handler returns nothing extra; the frontend just sees a rejected `fetch` with `AbortError`.
- **058's cross-tab regression guard** (`tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse`) MUST keep passing — Phase 060 changes are purely frontend, so the test's continued passage is automatic, but the chrome-mcp test in D-060-12 implicitly re-confirms it (Thread B's `getMessages` resolves <1s during Thread A's stream).
- **Phase 061 reintroduces E/F recovery on this clean foundation** — `setViewingThread` + `loadMessages(signal)` + `loadAbortRef` are the building blocks 061 will compose into the polling + visibilitychange handlers.

</code_context>

<specifics>
## Specific Ideas

- The `setViewingThread` callback name is locked by ROADMAP SC#1 — do not rename to `setActiveThread`, `setSelectedThread`, etc. Downstream consumers and the deferral document reference this exact name.
- Sentinel flow for navigation away (`thread === null`): `setViewingThread(null) → clearMessages() → return`. Don't call `loadMessages` with `null`.
- Test file naming: `060-thread-race.test.ts` (or `.tsx`/`.js` per existing convention) under whatever browser-test directory the repo uses. If creating fresh, prefer `tests/browser/` adjacent to existing `tests/integration/`.
- Verification doc: `.planning/phases/060-frontend-race-fixes/060-VERIFICATION.md` includes the manual two-tab DevTools timing checklist (mirror 058/059 format).
- The aggressive cleanup means the `UseMessages` interface shrinks — `subscribeToThread` and `unsubscribeFromThread` come off the exported type. Verify no other consumers exist via `grep -rn "subscribeToThread\|unsubscribeFromThread" frontend/src/` before deleting.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 061: Reconnect Handlers (Symptoms E + F).** Polling for F5 mid-stream + `visibilitychange` + `pageshow` for tab switch + Resume button UX. Builds directly on Phase 060's clean foundation — `setViewingThread` and `loadMessages(signal)` are reusable building blocks.
- **Phase 062: Validation Harness.** Reproducible chrome-MCP scripts for E/F/G/H + navigate-during-stream. Phase 060's chrome-mcp test (D-060-12) is the seed scenario; Phase 062 generalizes it into a reusable harness.
- **Phase 063: Skills Test Infrastructure Repair.** 13+ tests in `test_threads_skills.py` and 3 in `test_skills_import_export.py` patch a non-existent `create_streaming_chat` function (see `.planning/phases/059-sse-architecture-refactor/deferred-items.md`). Pre-Skills-Studio prep, not Phase 060's problem.
- **STREAM-03 (Realtime as low-latency hint layer).** Reintroducing Supabase Realtime as a best-effort enhancement on top of reconcile-via-fetch. Deferred to a later milestone — v2.5 doesn't need it once polling proves recovery works.
- **Cleanup of `streamingThreadIdRef` and `sendGenerationRef` legacy guards.** Likely subsumed by `setViewingThread` + `AbortController`; safe to delete if the diff stays focused (Claude's discretion). Tracked here so a future maintenance phase can finish the cleanup if 060 leaves them.
- **`UseMessages` interface stabilization / documentation.** With the post-060 surface (no `subscribeToThread`, no `unsubscribeFromThread`, plus new `setViewingThread`), a brief JSDoc block on each exported callback would help future contributors. Not in 060 scope.

</deferred>

---

*Phase: 060-frontend-race-fixes*
*Context gathered: 2026-05-02*
