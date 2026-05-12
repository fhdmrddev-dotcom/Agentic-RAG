# Phase 068: `<StreamsProvider>` Context Lift - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Hoist the run-stream subscription state — `subscriptionsRef`, `lastSeenOffsetRef`, `reconcileInFlightRef`, `activeThreadIdRef`, `streamingThreadIdRef`, and the `messagesByThread` Map — out of `frontend/src/hooks/useMessages.ts` (1229 LOC) into a new top-level `<StreamsProvider>` mounted near `frontend/src/App.tsx`. `useMessages` becomes a thin reader. Frontend-only; backend run-backed-streaming substrate (Phases 061/062/063 + Redis Streams per D-v2.5-08) is untouched. This phase consumes SEED-007 (the App-level Streams Provider seed deliberately deferred from Phase 063.1) pre-emptively per D-PRD-06, so v3.0 Skill Studio's eval pane lands on a clean substrate.

**What this phase does NOT do:**
- Build the actual v3.0 eval pane — that belongs to v3.0 Skill Studio.
- Touch backend code — the run-backed streaming API is provider-agnostic.
- Change `messages.confidence_*` reads or any other DB-bound logic.
- Modify the per-thread bucket invariant that Phase 067.5 Branch D-3 protects (the invariant survives the lift verbatim).

</domain>

<decisions>
## Implementation Decisions

### State store

- **D-068-01:** The provider's bucket state lives in a **Zustand** store (~1KB external dep). Selective subscription via per-slice selectors is the multi-consumer re-render hygiene mechanism the entire lift exists to enable. Plain React Context + useState was the SEED-007 sketch but is explicitly rejected here — every consumer would re-render on every state change, which defeats the point once a second surface (v3.0 eval pane, future admin-watch) mounts. `useSyncExternalStore` + custom store was also rejected — same selective-subscription behavior as Zustand but more code to hand-roll and no ecosystem maturity. Refs that don't drive re-renders (subscription AbortControllers, offset cursors, single-bit flags) stay as `useRef` inside the provider — they're handles, not display state.

### Provider API shape

- **D-068-02:** The store is wrapped in **named hooks per concern**, not exposed as raw selectors. Public surface:
  - `useThreadMessages(threadId: string | null, surfaceId?: SurfaceId)` — returns `Message[]` for the slice. `surfaceId` defaults to `'chat'`.
  - `useStreamActions()` — returns `{ subscribeToRun, reconcile, stopStream, sendMessage, setViewingThread, clearMessages }` with shallow-equality memoization so the returned object is referentially stable across renders.
  - `useStreamSubscriptions(runId: string)` — returns the AbortController status for a run (true if subscribed, false otherwise). Used by callers that need to gate on subscription state.
  - `useViewingThread()` — returns the current `activeThreadIdRef.current` snapshot as React state (so the UI re-renders on thread switch).
- **D-068-03:** Raw `useStreamsStore` is **not** part of the public API. Hide the Zustand dependency behind the wrappers so callers don't write selectors. Rationale: the named-hook layer is what gives us re-render hygiene (each hook subscribes only to its slice) without forcing every consumer to know about Zustand internals.

### Multi-consumer bucket model

- **D-068-04:** The store holds `bucketsBySurface: Map<SurfaceId, Map<thread_id, Message[]>>`. `SurfaceId` is a string type alias (e.g., `'chat' | 'eval' | 'admin-watch' | string`); chat callers use the default `'chat'`. A second surface (mocked in SC#3, real in v3.0) self-identifies by passing its own `surfaceId` to `subscribeToRun(runId, since, callbacks, signal, surfaceId)` and to the named hooks. This is surface-agnostic by design — adding a third surface doesn't restructure the store.
- **D-068-05:** The **per-thread bucket invariant** (Phase 067.5 Branch D-3) survives the lift verbatim. Specifically: inside each surface's Map, the rule "messages for thread T go into bucket T, not anyone else's" is preserved. The Branch D-3 `clearMessages` guard at `useMessages.ts:572-590` is ported byte-identically into the equivalent Zustand action, and a **dedicated Vitest regression test** asserts the guard fires identically post-lift (SC#2 binding gate). The same test fires for both `surfaceId='chat'` and a mocked second surface to prove the invariant holds per-surface.
- **D-068-06:** SEED-007's original `Map<run_id, Message[]>` per-run keying is **NOT** adopted in this phase. Reason: the PRD §6 Risk Surface explicitly locks the per-thread bucket invariant as surviving the lift. Per-run keying changes how every read/write site composes messages and would re-litigate that lock. Deferred (see `<deferred>` below) for a future phase if a real use case demands per-run composition.

### Reconcile listeners location

- **D-068-07:** The reconcile-triggering listeners (`visibilitychange`, `focus`, `pageshow`) **move into the provider**. The provider attaches them on mount in a `useEffect` and calls reconcile internally; the listener block at `frontend/src/components/chat/ChatArea.tsx:163-188` deletes entirely. Rationale: SEED-007's Wave 3 entry plan, plus the only-tab-resume signals are app-level (not chat-specific), so future surfaces (eval pane, admin watch) get reconcile-on-resume for free without re-wiring the listener block (the anti-pattern the seed warns against).
- **D-068-08:** Listeners gate on `activeThreadIdRef.current` (now inside the provider) — if no thread is viewing, reconcile is a no-op. This is implicit today via ChatArea only mounting when a thread is selected; with the provider mounted at App.tsx it must be explicit.

### Locked invariants that MUST survive the lift verbatim

- **L-068-01:** The Phase 067.5 Branch D-3 `clearMessages` guard at `useMessages.ts:572-590` — `if (tid && tid !== streamingThreadIdRef.current) { ... actually clear ... }`. Vitest regression test required (SC#2).
- **L-068-02:** D-063.1-11 `reconcileInFlightRef` boolean single-bit lock semantics — top-of-function bail; set true before Promise.all; release in finally. Concurrent reconcile calls still bail at the top guard.
- **L-068-03:** D-060-01 sole-writer pattern for `activeThreadIdRef` — `setViewingThread` is the only place that writes it. Post-await guard pattern (`if (activeThreadIdRef.current !== threadId) return`) still applies inside provider actions.
- **L-068-04:** D-067.3-R1-05 `streamingThreadIdRef` bucket-routing — incoming SSE deltas route to the streaming thread's bucket, not the viewing thread's. Survives verbatim.
- **L-068-05:** D-063.1-04 runId-match dedup in reconcile — when iterating activeRuns, look in current bucket for `m.runId === run.run_id`; reuse THAT message's id as the assistantId.
- **L-068-06:** D-063.1-12 `loadMessages` MERGE semantics for temp placeholders — three-clause filter (`m.id.startsWith('temp-') && m.runId && !dbRunIds.has(m.runId)`). Survives verbatim, just inside the provider.
- **L-068-07:** BL-03 cleanup pattern — `subscriptionsRef.current.delete(runId)` belongs to the terminal-event onTerminal callback, NOT to promise finally chains.

### Plan ordering (advisory; gsd-planner finalizes)

Aligns with SEED-007's suggested entry plan and the 4-plan budget in ROADMAP:

1. **Plan 1 — Store + provider scaffold.** Add Zustand dep. Create `frontend/src/stores/streamsStore.ts` (Zustand store with `bucketsBySurface` + refs-equivalent + actions). Create `frontend/src/providers/StreamsProvider.tsx` (mounts at App.tsx, attaches reconcile listeners in a useEffect, exposes named hooks). State + actions ported but **not yet consumed** — `useMessages` still owns its current code path. Existing tests stay green (no behavior change).
2. **Plan 2 — `useMessages` becomes thin reader.** Rewrite `useMessages` so its functions delegate to `useStreamActions()` and its state reads delegate to `useThreadMessages(threadId, 'chat')`. Public API of useMessages stays identical (ChatArea import unchanged). All existing Vitest unit tests pin the public surface as a regression net. Branch D-3 regression test (L-068-01) lands here.
3. **Plan 3 — Reconcile listeners move; ChatArea simplified.** Delete the listener block at `ChatArea.tsx:163-188`. Provider's mount-time useEffect owns visibilitychange/focus/pageshow. `reconcileRef` indirection deletes. ChatArea reads `useViewingThread()` + calls `useStreamActions().reconcile()` directly only for explicit triggers (e.g., manual resume button, if any).
4. **Plan 4 — Mocked second surface + Chrome MCP two-pane mock.** Add a Vitest unit test mounting two `useThreadMessages` consumers (`surfaceId='chat'` and `surfaceId='mock-eval'`) and asserts: (a) writes to one surface don't appear in the other, (b) Branch D-3 invariant holds per-surface, (c) re-render isolation works (mock-eval's setState doesn't re-render chat consumer). Add a dev-only `<DevTwoPaneMock>` React component behind `import.meta.env.DEV` flag that mounts a second `<MessageList>` consumer for Chrome MCP exercising. Re-run Phase 067.5 cycles via Chrome MCP under the new architecture as regression guard. Re-run Playwright e2e specs from Phases 063 / 063.1 / 067.x.

### Claude's Discretion

- Exact App.tsx wrap location (above or below auth gate, above or below router) — pick whatever keeps the store empty for unauthenticated users and avoids mounting twice across route changes. Sane default: below auth gate, above router.
- Whether `useMessages` keeps its name or gets renamed (e.g., `useChatMessages`) — keeping the name minimizes diff in callers (ChatArea, MessageList, etc.). Rename is fine if it falls out cleanly during Plan 2.
- Exact Zustand store layout (single slice vs sliced via `slices` pattern) — pick whatever keeps the file under ~400 LOC and reads cleanly. Likely one slice given the moderate state count.
- Whether `SurfaceId` is a string alias (`type SurfaceId = string`) or a branded type / enum const — string alias for v2.6; future tightening fine.
- Whether the `<DevTwoPaneMock>` component imports a real `<MessageList>` (proving full render path) or a stub (faster, less coverage) — pick whichever exercises the SC#3 invariant without coupling to chat's full toolbar/composer chrome.
- Naming of the mocked second `surfaceId` — `'mock-eval'` is fine for tests; production `surfaceId` for v3.0 eval pane is its own concern.
- Exact action-set on the Zustand store (which functions are "actions" vs methods on a selector) — match Zustand's idiomatic patterns; co-locate actions with state in the same store module.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 068's direct upstream artifacts

- `.planning/PRDs/v2.6.md` §3 Theme C — Streams Provider Pre-Emptive Lift requirements + risk surface entry §6 Theme C + scalability entry §7 (the ~6 EventSource-per-origin browser bound).
- `.planning/PRDs/v2.6.md` §4 Active row STREAMS-PROVIDER-01 — verification gate (Vitest unit + Chrome MCP two-pane mock + Playwright e2e regression).
- `.planning/seeds/SEED-007-app-level-streams-provider.md` — the source seed, including the 4-wave suggested entry plan that this CONTEXT's Plan ordering follows + the "single-buffer architecture today doesn't paint this into a corner — but extending it to multi-consumer requires the lift" framing.
- `.planning/ROADMAP.md` §Phase 068 — 4 success criteria + 4-plan budget + dependency declaration (none; Wave 0 parallel-able).
- `.planning/REQUIREMENTS.md` STREAMS-PROVIDER-01 — verification language anchor.

### Phase 063.1 — the architectural deferral source

- `.planning/milestones/v2.5-phases/063.1-frontend-stream-decoupling-gap-closure/063.1-CONTEXT.md` — D-063.1-01..15 + `<deferred>` "App-level Streams Provider" entry that became SEED-007. D-063.1-06 (single buffer chosen) is EXPLICITLY SUPERSEDED by this phase.
- `.planning/milestones/v2.5-phases/063.1-frontend-stream-decoupling-gap-closure/063.1-SUMMARY.md` (or equivalent) — implementation evidence for the runId-match dedup, MERGE semantics, in-flight lock that L-068-02 / L-068-05 / L-068-06 preserve.

### Phase 067.5 — the Branch D-3 guard source

- `.planning/milestones/v2.5-phases/067.5-frontend-reconcile-fix/067.5-01-SUMMARY.md` — Branch D-3 fix narrative + the 5/5 lived-experience cycles that close STREAM-04-correctness-round3. L-068-01 binds to this.
- `frontend/src/hooks/useMessages.ts:572-590` — the literal `clearMessages` guard block that survives the lift verbatim.

### Phase 067.3 — bucket-routing source

- `.planning/milestones/v2.5-phases/067.3-streaming-render-and-storage-fixes-round-2/067.3-CONTEXT.md` — D-067.3-R1-01 (`messagesByThreadRef` ref mirror) + D-067.3-R1-05 (`streamingThreadIdRef` as bucket-key for incoming deltas). L-068-04 preserves D-067.3-R1-05.

### Code surfaces that move or change

- `frontend/src/hooks/useMessages.ts` (1229 LOC) — entire single-buffer architecture lifts out; file shrinks to thin reader (~150-300 LOC).
- `frontend/src/hooks/useMessages.ts:572-590` — Branch D-3 `clearMessages` guard (verbatim port; regression-tested).
- `frontend/src/hooks/useMessages.ts:572-590, 956-1140` — `clearMessages` + `reconcile` core; both port to the store.
- `frontend/src/hooks/useMessages.ts:673` — `sendMessage`; ports to store action.
- `frontend/src/components/chat/ChatArea.tsx:163-188` — listener block deletes (D-068-07).
- `frontend/src/components/chat/ChatArea.tsx` other refs to `useMessages()` — switch to `useThreadMessages()` + `useStreamActions()` + `useViewingThread()`.
- `frontend/src/App.tsx` (40 LOC) — wraps tree in `<StreamsProvider>` near root (below auth gate per Claude's discretion).
- `frontend/src/lib/api.ts:274` — `subscribeToRun` already accepts the right shape (Phase 062 + 063.1 left the API correct); now takes an optional `surfaceId` param threaded through to where the buffer write decides which bucket to write into.

### Project-level locks (still in force)

- `CLAUDE.md` — Stack, "Stateless chat completions", "Stream chat responses via SSE", and the Realtime "best-effort hint" rule (D-v2.5-03). None of these are touched by this phase.
- `.planning/PROJECT.md` Key Decisions — D-v2.5-08 (run-backed streaming via Redis Streams) is the backend substrate; provider is frontend-only and does NOT touch this.
- `.planning/prd-reset/DECISIONS.md` D-PRD-06 — the explicit decision to lift SEED-007 pre-emptively in v2.6.

### New files this phase creates (estimated)

- `frontend/src/stores/streamsStore.ts` — the Zustand store (state + actions + types).
- `frontend/src/providers/StreamsProvider.tsx` — the React wrapper component with the named hooks exported.
- `frontend/src/__tests__/streamsProvider.test.tsx` (or similar) — Vitest unit test mounting two consumers; asserts Branch D-3 invariant per-surface + re-render isolation.
- `frontend/src/components/dev/DevTwoPaneMock.tsx` (or similar; behind `import.meta.env.DEV`) — the Chrome MCP exerciser surface.
- `frontend/package.json` — adds `zustand` dep (lock file changes too).

### No backend changes

- No new migrations. No `supabase/migrations/` slot claimed.
- No new SQL or schema changes.
- No `backend/app/api/*` files modified.
- `backend/app/api/threads.py` SSE event emission shape is UNCHANGED.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`subscriptionsRef.current: Map<run_id, AbortController>`** (useMessages.ts:427) — Already run-keyed and dedup-aware via `.has()`. Lifts as a `useRef` inside the provider, not into Zustand state (it's a handle, not display state).
- **`lastSeenOffsetRef.current: Map<run_id, string>`** (useMessages.ts:434) — Same; survives as ref inside provider. D-063.1-01..03 cursor mechanics preserved.
- **`reconcileInFlightRef.current: boolean`** (useMessages.ts:447) — Single-bit lock; ref inside provider. L-068-02.
- **`activeThreadIdRef`** (useMessages.ts:422) + `setViewingThread` (useMessages.ts:509) — Sole-writer pair. Both move into provider; `setViewingThread` becomes a Zustand action because it ALSO writes the `viewedThreadId` React state slot (useMessages.ts:385) so the UI re-renders on thread switch (this is the `useViewingThread()` hook's underlying state).
- **`streamingThreadIdRef`** (useMessages.ts:420) — Ref inside provider. Bucket-routing rule (L-068-04 / D-067.3-R1-05) survives byte-identically.
- **`guardedSetMessages`** pattern (D-063.1-08, originally lifted in Phase 063.1) — Already battle-tested. Inside the Zustand action layer, the same gate applies: `if (streamingThreadIdRef.current !== activeThreadIdRef.current) return` before writing the bucket.
- **`messagesByThreadRef.current`** mirror (useMessages.ts:409-412) — Phase 067.3 ref mirror that lets reconcile read fresh state. With Zustand, the store's `.getState()` replaces this — Zustand exposes synchronous reads outside React's render cycle. The ref mirror pattern goes away naturally.

### Established Patterns

- **Sole writer + post-await guard (D-060-01/02)** — Survives the lift. Inside Zustand actions, every cross-thread state mutation gates on `activeThreadIdRef.current === threadId` after any `await`.
- **Subscription cleanup belongs to onTerminal (BL-03)** — Survives. L-068-07.
- **Pydantic camelCase response (Phase 053+)** — Unchanged. No backend touched.
- **D-062-14 file-layout discipline** — `backend/app/api/threads.py` off-limits regions are untouched (no backend changes in this phase, by D-068-domain boundary).
- **Phase 067.3 ref mirror for fresh reads** — Made obsolete by Zustand's `.getState()`. Pattern dies cleanly during Plan 1; no special handling needed.

### Integration Points

- **`<StreamsProvider>` mount site** — `frontend/src/App.tsx` near root, below auth gate (Claude's discretion). All chat surfaces become provider consumers.
- **`useMessages` callers** — `frontend/src/components/chat/ChatArea.tsx:39` is the (currently) sole consumer per Phase 063.1's audit. After the lift, ChatArea calls `useThreadMessages()` / `useStreamActions()` / `useViewingThread()` directly; `useMessages` becomes a thin re-export wrapper that delegates to those hooks (kept for diff-minimization unless renaming falls out cleanly).
- **`subscribeToRun(runId, since, callbacks, signal, surfaceId?)` SSE entry point** — `frontend/src/lib/api.ts:274` already accepts `since` (Phase 062) and `signal` (Phase 063); adds optional `surfaceId` parameter. The buffer write decides which `bucketsBySurface[surfaceId][threadId]` to append to.
- **Reconcile listener attachment** — Moves from `ChatArea.tsx:163-188` to the provider's mount-time `useEffect`. ChatArea loses the listener block entirely (D-068-07).
- **`useEffect` cleanup on full hook unmount** (useMessages.ts:744-749 today) — Moves to provider's unmount cleanup. Aborts all subscriptionsRef entries. Only fires on logout/route-change-above-provider, same as today.

### Browser-bound constraint

- **~6 concurrent EventSource (fetch-streaming) per origin per tab** — Documented in PRD §7 scalability table. This phase doesn't exhaust the budget (chat = 1 stream, mock eval = 1 stream, totals 2). Worth noting in CONTEXT so future phases that stack more surfaces don't blow through it silently.

</code_context>

<specifics>
## Specific Ideas

- **The Branch D-3 guard is the binding regression net.** Phase 067.5 closed STREAM-04-correctness-round3 with literal 5/5 user-driven UAT cycles after one re-paint of the offending lines. Any deviation that breaks that guard regresses STREAM-04-correctness-round3 in a new shape. The Vitest regression test landing in Plan 2 is therefore THE binding gate for this phase, not an optional add. SC#2 phrasing: "preserved verbatim — Vitest regression test asserts the guard fires identically post-lift."
- **The mocked second surface is test-only and dev-panel-only.** No production code path creates a second surface in v2.6 — that's v3.0's job. SC#3's "second concurrent stream surface" exists only in Vitest + the `<DevTwoPaneMock>` dev panel + Chrome MCP exercising. This is intentional — the phase ships the substrate; v3.0 ships the use case.
- **Zustand selection is final, not exploratory.** Don't research alternatives during Plan 1; the tradeoffs were locked here. The store goes in.
- **SEED-007's 4-wave entry plan is the canonical plan blueprint.** gsd-planner should anchor to it (Plan ordering in `<decisions>`).
- **No `LangChain`, no `LangGraph`, no LangSmith touch** — this is a frontend refactor; the project-level "raw SDK calls only" rule has nothing to enforce here, but worth noting nothing in this phase imports those.

</specifics>

<deferred>
## Deferred Ideas

- **Per-run sub-bucket model `Map<run_id, Message[]>`** — SEED-007's original vision. Rejected for v2.6 because the PRD §6 Risk Surface locks "per-thread bucket invariant survives the lift", and per-run keying would re-litigate that lock. Re-open trigger: a use case that genuinely needs per-run composition (e.g., chat surface needing to render runs interleaved from multiple threads, or eval surface needing N concurrent eval runs against the same thread). At that point, restructure `bucketsBySurface[surface][threadId][runId]` or flatten to `bucketsBySurface[surface][runId]`.

- **Single `useStreamsContext()` mega-hook** — Considered as a drop-in-replacement API for useMessages. Rejected because the returned object identity changes on every store update, defeating Zustand's selective subscription. Re-open trigger: if the named-hook split causes ergonomic friction during Plan 2 implementation and a wrapper proves cleaner.

- **Plain React Context + useState/useRef store** — SEED-007's original sketch. Rejected in favor of Zustand for multi-consumer re-render hygiene. Re-open trigger: if zustand dep proves problematic in CI or bundling, fall back to useSyncExternalStore + custom (NOT plain Context — the perf concern stands).

- **Reconcile listeners staying in ChatArea** — Smaller-diff alternative considered. Rejected because future surfaces would need to duplicate the listener wiring (the anti-pattern SEED-007 explicitly warns against — "hard-coding cross-hook coordination via window globals or refs"). Re-open trigger: none anticipated.

- **`<StreamsProvider>` above the auth gate** — Considered so streaming state could survive logout/login (e.g., long-running eval continues across re-auth). Rejected because (a) no current use case, (b) keeping state empty for unauthenticated users is a privacy + memory win, (c) auth-gate-survival is a v3.3 Open Platform / v3.4 Automations concern. Re-open trigger: a background-task feature that intentionally outlives the auth session.

- **`useSyncExternalStore` + custom store** — Same selective-subscribe behavior as Zustand without the dep. Rejected because Zustand is a battle-tested ecosystem standard and rolling our own subscription manager is reinventing the wheel for ~1KB of avoided dep. Re-open trigger: a dep-minimization milestone or a CI/bundle constraint that disallows new frontend deps.

- **Renaming `useMessages` → `useChatMessages`** — Considered as part of D-068-02 cleanup. Deferred to Claude's discretion during Plan 2 — if rename falls out cleanly without ballooning the diff, do it; otherwise keep `useMessages` as a thin wrapper for diff-minimization.

</deferred>

---

*Phase: 068-streamsprovider-context-lift*
*Context gathered: 2026-05-12*
