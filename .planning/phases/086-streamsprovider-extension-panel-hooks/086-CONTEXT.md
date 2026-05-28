# Phase 086: StreamsProvider Extension + Panel Hooks - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Frontend wiring (no UI rendering) — extend the existing `StreamsProvider` /
`streamsStore` to demux 6 new SSE event types shipped by Phases 084/085 into
dedicated per-thread reactive state, ship 4 named hooks that Phase 087's panel
will consume, and reconcile via fetch on thread-switch per D-v2.5-03.

**In scope:**
- Extend `streamsStore.StreamsState` with 4 new per-thread Maps
  (`todosByThread`, `workspaceFilesByThread`, `pendingAsksByThread`,
  `tasksByThread`).
- Extend `api.ts:StreamCallbacks` interface with 7 new optional callbacks
  (`onTodoUpdated`, `onWorkspaceFileWritten`, `onWorkspaceFileDeleted`,
  `onAskUserPrompt`, `onAskUserResponse`, `onTaskStart`, `onTaskDone`).
- Extend `api.ts` SSE event dispatch (lines 419–460) to route the new event
  types into those callbacks, with payload-shape branching for
  `sub_agent_start`/`done` (existing `analyze_document` payload vs new `task`
  tool payload — see D-086-06).
- Ship 4 named hooks (`useTodos`, `useWorkspaceFiles`, `useAskUserPrompt`,
  `useTasks`) following the Phase 068 named-hook convention.
- Wire reconcile-on-thread-switch via the 4 backend GETs already shipped in
  Phase 085 D-085-23 + Phase 084 D-08.
- Extend `streamsCache.ts` localStorage hydration for `todosByThread` +
  `tasksByThread` only (cache version bumps once).

**Out of scope for Phase 086:**
- Panel UI rendering (Phase 087 — PANEL-01..PANEL-04, PANEL-07).
- Drill-down sub-agent stream subscription (Phase 087 calls existing
  `subscribeToRun(sub_run_id)` directly).
- Any backend changes (panel.py + workspace.py endpoints shipped in 084/085).
- New migrations.
- Accessibility (Phase 088 — A11Y-01, A11Y-02).
- User-flips-checkbox UX (deferred to v2.8 per 085-CONTEXT.md deferred section).
- Forwarding sub-agent deltas onto the parent stream (D-085-13/14 says full
  sub-agent transcript stays on `run:{sub_run_id}` Stream — not Phase 086's job).

</domain>

<decisions>
## Implementation Decisions

### Store architecture

- **D-086-01:** Extend `streamsStore` with 4 new top-level per-thread Maps on
  `StreamsState`: `todosByThread: Map<threadId, Todo[]>`,
  `workspaceFilesByThread: Map<threadId, WorkspaceFile[]>`,
  `pendingAsksByThread: Map<threadId, PendingAsk[]>`,
  `tasksByThread: Map<threadId, TaskRunIndexItem[]>`. Single store — mirrors
  the D-075.4-A1 per-thread Map pattern verbatim. Adds ~150 LOC to
  `streamsStore.ts` (currently 146 LOC); no split.
- **D-086-02:** New named hooks live in `StreamsProvider.tsx` alongside
  `useThreadMessages` / `useStreamActions` / `useStreamSubscriptions` /
  `useViewingThread` (D-068-02 named-hook convention). Raw
  `useStreamsStore` stays implementation detail.
- **D-086-03:** `streamsCache.ts` localStorage hydration extends to
  `todosByThread` + `tasksByThread` only (cheap, high-value for first paint).
  NOT applied to `pendingAsksByThread` (ephemeral; stale prompts would mislead
  the user into thinking the agent is still waiting). NOT applied to
  `workspaceFilesByThread` (potentially large blobs; the GET is cheap).
- **D-086-04:** Single `streamsCache` version bump for the whole panel
  addition (minor V → V+1). Future panel-state additions in v2.8 bump again.
- **D-086-05:** PANEL-06 (no chat re-renders from panel events) achieved
  structurally by Zustand `subscribeWithSelector` middleware + per-thread Map
  selectors with module-level `EMPTY_TODOS` / `EMPTY_FILES` / `EMPTY_ASKS` /
  `EMPTY_TASKS` constants for stable empty refs (RESEARCH §Finding #1 pattern
  from Phase 068).

### Event routing

- **D-086-06:** `sub_agent_start` / `sub_agent_done` payload-shape branching
  in `api.ts` dispatcher. If `parsed.sub_run_id` is present → invoke new
  `onTaskStart(sub_run_id, description, tools, max_steps)` /
  `onTaskDone(sub_run_id, status, summary)`. Else → existing
  `onSubAgentStart(filename, task)` / `onSubAgentDone()` callbacks fire
  unchanged. The `analyze_document` path is byte-identical post-Phase-086
  (cross-provider safety — `feedback_no_cross_provider_regressions`).
- **D-086-07:** Phase 086 owns only the bookend `task` events (start + done).
  No `task_delta` on the parent stream — sub-agent's full transcript stays on
  its own `run:{sub_run_id}` Stream per D-085-13/14. Phase 087's drill-down
  view will use the existing `subscribeToRun(sub_run_id)` primitive directly;
  Phase 086 does NOT ship a `useTaskStream(sub_run_id)` hook.
- **D-086-08:** `useAskUserPrompt` reconcile strategy is SSE-precedence with
  fetch as recovery. The `ask_user_prompt` SSE adds to `pendingAsksByThread`;
  the `ask_user_response` SSE removes it; thread-switch reconcile via
  `GET /ask_user/pending` REPLACES the per-thread inner Map atomically
  (closes the multi-tab / refresh / worker-restart gap). Symmetric with how
  `bucketsBySurface` already works for chat messages (D-v2.5-03 — Realtime
  is best-effort, reconcile via fetch).

### Hook surface contract

- **D-086-09:** Explicit `threadId` arg on all four hooks —
  `useTodos(threadId: string | null)`, `useWorkspaceFiles(threadId)`,
  `useAskUserPrompt(threadId)`, `useTasks(threadId)`. Null-safe: when
  `threadId === null`, hook returns the module-level EMPTY constant and
  skips reconcile. Matches Phase 068's `useThreadMessages(threadId)`. No
  hidden auto-bind to active thread — Phase 087 may need to render the
  panel for a non-viewed thread (split-view, future v2.8 multi-panel UX).
- **D-086-10:** Return shape per hook:
  ```ts
  { data: T[]; isLoading: boolean; error: Error | null; reconcile: () => Promise<void> }
  ```
  - `data` never undefined — defaults to module-level EMPTY constant (stable ref).
  - `isLoading` is true ONLY during the initial reconcile fetch (NOT for
    SSE-driven updates which are instant per D-086-05).
  - `error` is the last reconcile failure (cleared when next reconcile
    succeeds OR when a fresh SSE event arrives cleanly).
  - `reconcile()` is the manual retry escape hatch (wired to a retry button
    in Phase 087's error banner).
- **D-086-11:** Read-only in v1. Agent owns writes via tools; panel renders.
  PANEL-02 v1 explicit "status indicators" = display-only. User-flips-checkbox
  is deferred to v2.8 (085-CONTEXT.md deferred section).
- **D-086-12:** No `useTaskStream(sub_run_id)` drill-down hook in Phase 086.
  Phase 087 calls `subscribeToRun(sub_run_id)` (existing primitive) when it
  builds the drill-down view.

### Reconcile mechanics

- **D-086-13:** Parallel + per-hook error. Each hook owns its own reconcile
  fetch in its own `useEffect` on `[threadId]`. The 4 hooks fan out
  independently — a `workspace/files` 500 does NOT break the todos panel.
  Per-hook error stored in an extended `reconcileErrors` Map keyed by
  `${threadId}:${hookId}` (e.g., `"abc-123:todos"`). The 4 GETs hit different
  DB tables so they truly parallelize.
- **D-086-14:** SWR + thread-switch trigger + AbortController. Last-known
  data stays visible during reconcile (no flash-of-empty). Reconcile fires
  from `useEffect` on `[threadId]` change only (one writer per hook —
  mirrors L-068-03 sole-writer rule). Each fetch gets an AbortController;
  switching threads aborts the in-flight fetch via `controller.abort()` in
  the effect cleanup (L-068-02 in-flight lock pattern).
- **D-086-15:** NO visibility/focus reconcile triggers for panel hooks.
  Phase 068's chat reconcile fires on `visibilitychange` / `focus` /
  `pageshow`; panel data is lower-stakes — reconcile only on thread-switch +
  manual `reconcile()` escape hatch. Prevents fan-out hammering on noisy
  tab-switching (a focus storm would spawn 4 fetches per panel hook).

### Cross-cutting compliance

- **D-086-16:** SC#10 4-axis UAT applies in full. Phase 086 touches UI state.
  Authored in `086-VALIDATION.md`, NOT `086-NN-PLAN.md`. MUST cover ≥ 4
  providers (OpenAI, Anthropic, Google, OpenRouter) × multi-tool
  (e.g., `write_todos` + `workspace_write` + `ask_user` in one prompt) ×
  parallel-thread (Thread A streaming todos while Thread B receives an
  ask_user prompt) × long-message (≥ 50 prior messages OR ≥ 5 KB user prompt).
- **D-086-17:** G-4 lived-experience UAT scenarios defined upfront:
  1. Switch threads mid-stream while an `ask_user` prompt is pending on
     Thread A → switching back to A must reconcile and re-display the prompt.
  2. Submit an `ask_user` response while a parallel Thread B is streaming
     todos → both threads' panel state stays independent (zero cross-thread
     bleed; PANEL-06 verified).
  3. Refresh the page during an active `ask_user` prompt → first paint
     shows cached panel data (todos / tasks via localStorage); reconcile
     fetches pending asks within ~500 ms (since pendingAsks NOT cached
     per D-086-03).
  4. SSE `buffer_expired` during a `task` sub-agent run → panel reconciles
     via `GET /tasks` on subscription restart, does NOT lose the sub-agent
     from `tasksByThread`.
- **D-086-18:** G-5 hot-file ledger check: `StreamsProvider.tsx` was
  satisfied by Phase 075.7 (2026-05-24); `streamsStore.ts` is on the
  ledger via D-075.4-A1 changes. Phase 086 changes are STRICTLY ADDITIVE
  (new callbacks, new Maps, new hooks; existing event handlers UNCHANGED;
  existing per-thread state UNTOUCHED). No G-5 re-fire — confirmed via
  `feedback_no_cross_provider_regressions` rule (no shared-code-path
  modifications to existing handlers).
- **D-086-19:** No backend changes in Phase 086. All consumed endpoints
  shipped:
  - `GET /threads/{tid}/workspace/files` — Phase 084 D-08
  - `GET /threads/{tid}/workspace/files/{file_id}/content` — Phase 084 D-08
    (used by Phase 087 preview, not 086)
  - `GET /threads/{tid}/todos` — Phase 085 D-085-23
  - `GET /threads/{tid}/ask_user/pending` — Phase 085 D-085-23
  - `GET /threads/{tid}/tasks` — Phase 085 D-085-23
- **D-086-20:** No new migrations.

### Bug cross-check (CLAUDE.md MANDATORY)

- **D-086-21:** 2 open + 2 deferred Agentic-RAG bugs reviewed against Phase
  086's scope. None folded (all outside the additive store/hook layer):
  - `step-count-mismatch-timer-vs-panel.md` (`status: open`) — ToolCallPanel
    rendering concern, not the store/hook layer Phase 086 owns. Route to a
    future polish phase.
  - `timer-disappears-long-runs.md` (`status: open`) — chat-stream timer
    domain, not panel state.
  - `non-anthropic-generic-code-task-descriptions.md` (`status: open`) —
    ToolCallPanel rendering concern.
  - `anthropic-end-of-cycle-shows-actions-not-summary.md` (`status: deferred`)
    — stays deferred.
  - `anthropic-excessive-tool-iterations-on-multi-step-tasks.md`
    (`status: deferred`) — stays deferred.

### Claude's Discretion

- Exact callback names: `onTaskStart` / `onTaskDone` (recommended) vs
  `onSubTaskStart` / `onSubTaskDone` vs `onAgentTaskStart` / `onAgentTaskDone`.
  Pick what reads cleanest in `api.ts:209` interface and the
  `makeStreamCallbacks` closure.
- Whether to factor a shared `usePanelReconcile<T>(fetcher, threadId, …)`
  helper hook for the SWR + AbortController + `reconcileErrors` plumbing,
  or inline the pattern in each of the 4 hooks. Inline is fine for 4
  copies; helper is fine if duplication feels excessive — Planner finalizes.
- Number of plans: likely 2 (Plan 01 = store + dispatcher branching + 4
  hooks + cache hydration; Plan 02 = SC#10 UAT matrix + G-4 lived-experience
  UAT scenarios). Planner finalizes after research-skip per ROADMAP.
- TypeScript type definitions: where `Todo`, `WorkspaceFile`, `PendingAsk`,
  `TaskRunIndexItem` live. Default: `frontend/src/types/index.ts`. Wire
  format MUST match the JSON response shapes in `backend/app/api/panel.py`
  (todos endpoint reshapes `todo_id` → `id`) and `backend/app/api/workspace.py`.
- Cache-version bump strategy in `streamsCache.ts` — minor bump (V → V+1)
  since panel state is purely additive; no breaking change for chat
  bucket hydration.

</decisions>

<failure_criteria>
## How we'd know this failed (G-6 — failure criteria upfront)

Phase 086 fails if ANY of these observable conditions hold after the phase ships:

1. **Chat re-renders from panel events** — `MessageItem.tsx` or
   `MessageList.tsx` rerenders when a `todo_updated` / `workspace_file_*` /
   `ask_user_*` event fires. PANEL-06 violation; selector hygiene broken.
2. **Two SSE connections per thread** — DevTools Network tab shows two
   open `text/event-stream` connections when the panel is open alongside
   chat. PANEL-05 violation.
3. **sub_agent_start event mis-routing** — `analyze_document`'s
   `sub_agent_start{filename, task}` accidentally invokes `onTaskStart`,
   OR `task` tool's `sub_agent_start{sub_run_id, …}` invokes
   `onSubAgentStart` — payload-shape branching is faulty (D-086-06).
4. **analyze_document regression** — Any existing onSubAgentStart /
   onSubAgentDelta / onSubAgentDone callback fires differently after
   Phase 086 ships. Detected via existing Phase 075.4 E2E backstop
   scenarios for analyze_document.
5. **Rapid thread-switch stale data** — User switches Thread A → B → A
   within 200 ms; Thread A's panel shows Thread B's todos for any
   visible duration. AbortController missing or wrongly scoped (D-086-14).
6. **ask_user_response orphan** — Pending prompt stays in
   `pendingAsksByThread` after the matching `ask_user_response` SSE
   arrives. Frontend dispatch broken; D-086-08 invariant violated.
7. **Refresh-loses-ask** — Page refresh during an active `ask_user`
   prompt loses the prompt entirely. Reconcile not firing on first paint
   or fetch endpoint misaligned (D-086-08).
8. **localStorage cross-user leak** — Hydrated `todosByThread` from
   localStorage shows todos belonging to a different user's last session.
   Cache version mismatch OR cache key doesn't include user_id.
9. **Provider-specific dispatch hole** — Cross-provider UAT shows a
   provider (e.g., Google or DeepSeek) where the backend emits
   `todo_updated` but `useTodos` doesn't update. Event-name typo in
   `api.ts` dispatcher OR provider emits a different wire shape.
10. **Cross-worker ask_user gap** — Worker B's `ask_user_response` arrives
    on the EventSource but `useAskUserPrompt` on the Worker-A-bound thread
    doesn't reflect it. Redis pub/sub plumbing is OK per Phase 085 SC#4,
    but the frontend dispatch path is broken.

Each is testable. Planning's `086-VALIDATION.md` surfaces ≥ 1 UAT or
integration row per failure mode.

</failure_criteria>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase boundary inputs
- `.planning/ROADMAP.md` §Phase 086 — 3 success criteria + research-skip note
- `.planning/REQUIREMENTS.md` — PANEL-05, PANEL-06 (Phase 086's scoped requirements)
- `.planning/PROJECT.md` — v2.7 milestone context
- `.planning/phases/083-foundation-tool-dispatch-extraction-bug-fixes/083-CONTEXT.md` — tool dispatcher pattern
- `.planning/phases/084-workspace-filesystem-backend/084-CONTEXT.md` — workspace SSE events + REST endpoints
- `.planning/phases/085-new-llm-tools/085-CONTEXT.md` — todos / task / ask_user event names + REST endpoints

### Frontend integration sites
- `frontend/src/providers/StreamsProvider.tsx` (1599 LOC) — D-068-01..08, L-068-01..07, D-075.4-A1 per-thread state lift; ADD new named hooks here
- `frontend/src/stores/streamsStore.ts` (146 LOC) — `StreamsState` shape, `subscribeWithSelector` middleware; ADD 4 new per-thread Maps here
- `frontend/src/lib/api.ts:209` — `StreamCallbacks` interface; ADD 7 new optional callbacks here
- `frontend/src/lib/api.ts:419-460` — SSE event dispatch chain; ADD 6 new event-type branches (with payload-shape branching for sub_agent_start/done)
- `frontend/src/lib/api.ts:241` — `makeStreamCallbacks` factory; ADD 7 new no-op default handlers
- `frontend/src/lib/streamsCache.ts` — localStorage hydration; ADD `todosByThread` + `tasksByThread` slots + cache version bump
- `frontend/src/types/index.ts` (or wherever) — ADD `Todo`, `WorkspaceFile`, `PendingAsk`, `TaskRunIndexItem` types matching panel.py wire format

### Backend endpoints consumed (already shipped — read-only here)
- `backend/app/api/panel.py:67` — `GET /threads/{tid}/todos`
- `backend/app/api/panel.py:103` — `GET /threads/{tid}/ask_user/pending`
- `backend/app/api/panel.py:156` — `GET /threads/{tid}/tasks`
- `backend/app/api/workspace.py` — `GET /threads/{tid}/workspace/files` (Phase 084 D-08)
- `backend/app/api/runs.py:496` — `POST /runs/{rid}/ask_user_response` (panel posts here in Phase 087)

### Backend event emit sites (read-only — DO NOT modify)
- `backend/app/services/tool_dispatcher.py:892` — `workspace_file_written` emit (Phase 084)
- `backend/app/services/tool_dispatcher.py:987` — `workspace_file_deleted` emit (Phase 084)
- `backend/app/services/tool_dispatcher.py:1239` — `todo_updated` emit (Phase 085)
- `backend/app/services/tool_dispatcher.py:1357` — `ask_user_prompt` emit (Phase 085)
- `backend/app/api/runs.py:560` — `ask_user_response` emit (Phase 085)
- `backend/app/services/task_service.py:264` — `sub_agent_start` emit with sub_run_id (Phase 085 — new payload variant)
- `backend/app/services/task_service.py:428` — `sub_agent_done` emit with sub_run_id (Phase 085 — new payload variant)
- `backend/app/services/tool_dispatcher.py:235` — `sub_agent_start` emit with filename/task (Phase 083+ — existing analyze_document, must stay byte-identical)
- `backend/app/services/tool_dispatcher.py:270` — `sub_agent_delta` emit (existing — Phase 086 leaves untouched)
- `backend/app/services/tool_dispatcher.py:276` — `sub_agent_done` emit no-payload (existing analyze_document)

### Project-level decision records
- `.planning/prd-reset/DECISIONS.md` D-v2.5-03 — Realtime best-effort, reconcile via fetch on (re)connect
- `.planning/prd-reset/DECISIONS.md` D-v2.5-08 — Run-backed streaming via Redis Streams (foundation for SSE)
- `.planning/prd-reset/DECISIONS.md` D-PRD-12 — Multi-worker uvicorn (cross-worker ask_user concern in D-086-08 traces back here)

### Cross-cutting rules (`CLAUDE.md`)
- SC#10 (4-axis UAT) — MANDATORY for phases touching UI state
- G-4 (lived-experience UAT gate) — operator-defined scenarios at scope-time
- G-5 (hot-file ledger) — `StreamsProvider.tsx` + `streamsStore.ts` already on it; additive-only respects satisfied status
- G-6 (failure criteria upfront) — see `<failure_criteria>` above

### Anti-patterns + feedback memories
- `feedback_no_cross_provider_regressions` — additive-only, no shared-code-path modifications to existing event handlers
- `feedback_provider_uniform_ux` — one UX, multiple backend adapters; new callbacks stay provider-agnostic
- `feedback_uat_lived_experience_gap` — UAT exercises felt experience (D-086-17)
- `feedback_chrome_mcp_testing` — Chrome DevTools MCP drives the G-4 lived-experience UAT during verify
- `reference_local_dev_app` — test login `fhdmrd@gmail.com / 123456` for Chrome MCP authenticated flows

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StreamCallbacks` interface (`api.ts:209`) — extend with 7 new optional callbacks. Existing dispatch chain (lines 419–460) is the integration template — copy the `else if (t === "<event>" && callbacks.onX)` shape verbatim.
- `makeStreamCallbacks` factory (`api.ts:241`) — closure-captures `surfaceId` per L-068-04; extend with 7 default no-op handlers that write to `streamsStore` actions.
- `StreamsState` + `subscribeWithSelector` middleware (`streamsStore.ts:36`) — the foundation. 4 new Maps slot in alongside existing per-thread fields (`streamingThreads`, `fallbackNotices`, `reconcileErrors`, `loadingThreads`, `subscriptionsByThread`).
- `streamsCache.ts` localStorage layer — already supports cache versioning + first-paint sync hydration (D-068.5-01..04). Extend the persisted shape; bump version.
- `makeThrottle` (`lib/throttle.ts`) — available if SSE bursts on `todo_updated` need batching (write_todos full-state-replace can emit many rows at once).
- Named-hook layer in `StreamsProvider.tsx` — existing hooks (`useThreadMessages` / `useStreamActions` / `useStreamSubscriptions` / `useViewingThread`) are the structural template for the 4 new hooks.
- `reconcileErrors: Map<string, Error>` (`streamsStore.ts:68`) — already in store; extend keying from `threadId` to `${threadId}:${hookId}` to support 4 parallel reconcile fetches per thread.

### Established Patterns
- **Per-thread Map<threadId, T>** (D-075.4-A1) — copy verbatim for all 4 new Maps. The existing `streamingThreads: Set<string>` / `fallbackNotices: Map<string, string>` lines are the template.
- **Named-hook layer hides raw store** (D-068-02) — never export `useStreamsStore` directly; the panel imports `useTodos` etc.
- **Module-level EMPTY constants for stable empty refs** (RESEARCH §Finding #1) — `EMPTY_ARRAY: Message[] = []` at `StreamsProvider.tsx:86` is the template. Each new hook needs its own `EMPTY_TODOS`, `EMPTY_FILES`, `EMPTY_ASKS`, `EMPTY_TASKS`.
- **Sole-writer rule for refs** (L-068-03) — for `activeThreadIdRef`-style refs the 4 new hooks add (e.g., `lastReconciledThreadRef`), exactly one writer.
- **AbortController per fetch** (L-068-02) — extend the in-flight lock pattern to each hook's reconcile.
- **Action registration in provider's mount-time useEffect** (RESEARCH §Pitfall 3) — new actions for the 4 Maps register here; synchronous actions ship as no-op stubs in the store (`streamsStore.ts:80`).
- **Cache hydration in factory** (D-068.5-01) — `readSnapshotSyncOrEmpty` reads localStorage in the Zustand factory body so first paint sees cached content.

### Integration Points
- `frontend/src/lib/api.ts:209` — `StreamCallbacks` interface — ADD 7 callbacks
- `frontend/src/lib/api.ts:419-460` — SSE event dispatch chain — ADD 6 new branches + payload-shape branch for sub_agent_start/done
- `frontend/src/lib/api.ts:241` — `makeStreamCallbacks` — ADD 7 default no-op handlers + closure-captured store-action calls
- `frontend/src/lib/api.ts` — ADD 4 GET helper functions: `getThreadTodos(threadId)`, `getThreadWorkspaceFiles(threadId)`, `getThreadPendingAsks(threadId)`, `getThreadTasks(threadId)` — thin wrappers over `fetch` with auth header (or extend the existing API helper pattern)
- `frontend/src/stores/streamsStore.ts:43` — `StreamsState` interface — ADD 4 new Maps + 4 new actions
- `frontend/src/stores/streamsStore.ts:80` — `actions` object — ADD 4 new action stubs (synchronous no-ops per RESEARCH §Pitfall 5)
- `frontend/src/providers/StreamsProvider.tsx` — ADD 4 new named hooks + action body registration in mount-time useEffect
- `frontend/src/lib/streamsCache.ts` — ADD `todosByThread` + `tasksByThread` to persisted shape + bump version
- `frontend/src/types/index.ts` (or wherever) — ADD `Todo`, `WorkspaceFile`, `PendingAsk`, `TaskRunIndexItem` types

### New code surfaces (Phase 086 owns)
- `frontend/src/providers/StreamsProvider.tsx` named hooks: `useTodos`, `useWorkspaceFiles`, `useAskUserPrompt`, `useTasks`
- `frontend/src/lib/api.ts:StreamCallbacks` new callbacks: `onTodoUpdated`, `onWorkspaceFileWritten`, `onWorkspaceFileDeleted`, `onAskUserPrompt`, `onAskUserResponse`, `onTaskStart`, `onTaskDone`
- `frontend/src/lib/api.ts` GET helpers: `getThreadTodos`, `getThreadWorkspaceFiles`, `getThreadPendingAsks`, `getThreadTasks`
- `frontend/src/stores/streamsStore.ts` Maps + actions: `todosByThread` + `setTodosForThread` + `replaceTodosForThread`; `workspaceFilesByThread` + `setWorkspaceFileForThread` + `removeWorkspaceFileForThread` + `replaceWorkspaceFilesForThread`; `pendingAsksByThread` + `addPendingAskForThread` + `removePendingAskForThread` + `replacePendingAsksForThread`; `tasksByThread` + `setTaskForThread` + `updateTaskStatusForThread` + `replaceTasksForThread`
- Optionally: `frontend/src/hooks/usePanelReconcile.ts` shared SWR helper (Claude's discretion)

</code_context>

<specifics>
## Specific Ideas

- The sub_agent_start payload-shape branching is the highest-risk decision —
  it's the only place Phase 086 plumbing has to disambiguate between two
  existing-and-new event shapes on the same name. Test rig MUST exercise
  BOTH `analyze_document` (legacy payload) AND `task` (new payload) on the
  same thread in one of the SC#10 UAT rows to catch any cross-wiring.
- Per-thread reconcileErrors keying — extending from `Map<string, Error>` to
  `Map<string, Error>` with `${threadId}:${hookId}` composite key is the
  minimal change; alternatives (nested `Map<threadId, Map<hookId, Error>>`)
  add structure but no value for 4 hooks.
- `useAskUserPrompt` returns an ARRAY of pending prompts (`PendingAsk[]`),
  not a single prompt — D-085-06 supports parallel ask_user calls. Phase 087
  renders the stack; Phase 086 surfaces the array.
- The 4 new GET helpers in api.ts should mirror the existing fetch helper
  style (look for `getMessages` / `getSnapshot` patterns at api.ts top).
  Don't introduce a new fetch library; reuse what's there.
- Cache version bump in streamsCache.ts: a single minor bump invalidates
  ALL existing chat-bucket caches too — accept this one-time UX hit (users
  see one cold reload after deploying Phase 086) rather than juggling
  separate cache namespaces. Document the bump in the commit message.
- `useTasks` returns `TaskRunIndexItem[]` — the run index from
  `GET /threads/{tid}/tasks`. Each item carries `sub_run_id` + status +
  model + started_at. Phase 087 uses `sub_run_id` to open the drill-down
  EventSource via `subscribeToRun(sub_run_id)`.

</specifics>

<deferred>
## Deferred Ideas

- **`useTaskStream(sub_run_id)` drill-down hook** — Phase 087 owns. Phase 086
  ships only the run index via `useTasks(threadId)`. Re-open trigger: Phase 087
  scope formally adds a sub-agent transcript drill-down view.
- **Single batched GET /threads/{tid}/panel/snapshot endpoint** — Defer to v2.8
  when the panel state grows beyond 4 surfaces and parallel fetching starts
  to feel like fan-out hammering. Current 4-endpoint fan-out is fine for v1.
- **visibilitychange / focus / pageshow reconcile triggers for panel** —
  D-086-15 explicitly excludes these. Re-open trigger: user reports
  panel-data staleness after long backgrounded tabs. Current SSE-precedence
  + thread-switch reconcile handles 99% of cases.
- **User-flips-checkbox UX on todos** — out of scope per PANEL-02 v1
  ("status indicators" = display-only). Already noted in 085-CONTEXT.md
  deferred section; v2.8 follow-up.
- **`task_delta` event on parent stream** — D-086-07 explicitly NOT emitted.
  Re-open trigger: operator UAT shows the panel feels too quiet during long
  sub-agent runs and the bookend-only UX is unsatisfying.
- **Reviewed bugs (not folded)** — open Agentic-RAG bugs `step-count-mismatch-timer-vs-panel`, `timer-disappears-long-runs`, `non-anthropic-generic-code-task-descriptions` all reviewed during D-086-21; none folded (outside additive store/hook scope). Route to a future polish phase.

</deferred>

---

*Phase: 086-streamsprovider-extension-panel-hooks*
*Context gathered: 2026-05-28*
