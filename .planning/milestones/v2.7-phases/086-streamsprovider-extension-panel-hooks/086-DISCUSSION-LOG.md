# Phase 086: StreamsProvider Extension + Panel Hooks - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 086-streamsprovider-extension-panel-hooks
**Areas discussed:** Store shape, sub_agent_* event collision, Hook surface contract, Thread-switch reconcile strategy

---

## Store shape

### Q1: Where should the new panel state live in the store?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend streamsStore | Add 4 new top-level per-thread Maps to existing StreamsState. Recommended — mirrors Phase 075.4-A1 per-thread pattern. | ✓ (by Claude delegation) |
| Separate panelStore | New panelStore.ts with own create() + subscribeWithSelector. Doubles boilerplate. | |
| Namespace inside streamsStore | streamsStore.panel = {…}. Adds .panel hop to every selector. | |

**User's choice:** Free-text — "you should decide based on your knowledge of the application and future plans maintaining quality, accuracy, error and failure free and competitive advantage"
**Claude's decision:** Extend streamsStore (D-086-01).
**Rationale:** Phase 075.4-A1 per-thread Map pattern is proven and idiomatic in this codebase. `subscribeWithSelector` + selector hygiene already guarantees PANEL-06 isolation; splitting stores would double mount/reconcile boilerplate without adding isolation. Future v2.8 panel-state additions scale better in one place.

### Auxiliary choices locked by same delegation

- Hooks live in StreamsProvider.tsx alongside useThreadMessages (D-086-02).
- localStorage hydration: todos + tasks only (D-086-03) — pendingAsks ephemeral, workspaceFiles potentially large.
- Single cache version bump for panel addition (D-086-04).
- PANEL-06 via subscribeWithSelector + module-level EMPTY constants (D-086-05).

---

## sub_agent_* event collision

### Q1: Existing analyze_document emits sub_agent_start{filename, task}. New task tool emits sub_agent_start{sub_run_id, description, tools, max_steps}. Same event name, different payload. How should the frontend route them?

| Option | Description | Selected |
|--------|-------------|----------|
| Branch on payload shape | In api.ts dispatcher, check if parsed.sub_run_id is present. | ✓ |
| Rename task events backend-side | task_start / task_done instead. Requires Phase 086 to touch task_service.py. | |
| Add source field to payload | {source: 'task'} field. Medium churn at both emit sites. | |

**User's choice:** Branch on payload shape.
**Decision:** D-086-06. Zero backend churn, zero risk to analyze_document path.

### Q2: Where should the branching live, and what's the callback shape?

| Option | Description | Selected |
|--------|-------------|----------|
| api.ts dispatcher + new callbacks | onTaskStart / onTaskDone added to StreamCallbacks. Branch at dispatcher. | ✓ |
| Store action + single callback | Single onSubAgentStart, payload: unknown, branch in store action. | |

**User's choice:** api.ts dispatcher + new callbacks.
**Decision:** Folded into D-086-06. Stronger type safety, narrower blast radius.

### Q3: Should the task tool's sub-agent emit deltas to the parent stream?

| Option | Description | Selected |
|--------|-------------|----------|
| Bookend only (start + done) | Match D-085-13/14. Drill-down via Phase 087 + existing subscribeToRun. | ✓ |
| Forward delta events to parent | Adds task_delta event. Requires Phase 085 backend changes — out of scope. | |

**User's choice:** Bookend only.
**Decision:** D-086-07.

### Q4: Drill-down hook ownership + useAskUserPrompt reconcile precedence

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 086 owns drill-down + SSE-precedence | useTaskStream(sub_run_id) in 086 + SSE state wins | |
| Defer drill-down + reconcile-precedence | useTasks(threadId) only in 086, fetch canonical | |
| Phase 086 owns + reconcile-precedence | Both above | |

**User's choice:** Free-text — "you decide"
**Claude's decision:** Hybrid — defer drill-down to Phase 087 (D-086-12), SSE-precedence for ask_user reconcile (D-086-08).
**Rationale:** Phase 087 has the UI context to decide drill-down shape; existing `subscribeToRun(sub_run_id)` is the right primitive. SSE-precedence keeps the panel feeling instant; fetch as recovery handles D-v2.5-03 (Realtime best-effort).

---

## Hook surface contract

### Q1: Hook signature: how do consumers bind to a thread?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit threadId arg | useTodos(threadId). Matches Phase 068 useThreadMessages. | ✓ (by Claude delegation) |
| Auto-bind to viewing thread | useTodos() reads useViewingThread internally. Hidden coupling. | |
| Both — default to viewing, overridable | useTodos(threadId?). 'undefined-means-active' edge case. | |

**User's choice:** Free-text — "you decide based on your knowledge of the app and future plans, maintaining quality, error and failure free and maintaining competitive advantage"
**Claude's decision:** Explicit threadId arg (D-086-09).
**Rationale:** Future v2.8 split-view or multi-panel UX needs to render the panel for non-viewed threads; explicit args don't paint that future into a corner. Matches Phase 068 convention.

### Auxiliary choices locked by same delegation

- Return shape: `{ data, isLoading, error, reconcile }` (D-086-10).
- Read-only v1 — no optimistic state (D-086-11).
- No useTaskStream(sub_run_id) in 086 (D-086-12 — Phase 087 reuses subscribeToRun).

---

## Thread-switch reconcile strategy

### Q1: On thread-switch, the panel needs to fetch 4 things. How should that fire?

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel + per-hook error | Each hook owns its own reconcile. Decoupled. | ✓ |
| Centralized batch from StreamsProvider | Provider fans out + writes atomically. Couples panel into chat provider. | |
| Single batched backend endpoint | GET /threads/{tid}/panel/snapshot. Requires new backend work. | |

**User's choice:** Parallel + per-hook error.
**Decision:** D-086-13.

### Q2: SWR + thread-switch trigger + AbortController vs alternatives?

| Option | Description | Selected |
|--------|-------------|----------|
| SWR + thread-switch + AbortController | Recommended. Mirrors L-068-02/03. | ✓ |
| Blank-on-switch + first-paint refetch | Flash of empty. Fights localStorage hydration. | |
| SWR + visibility/focus triggers | More aggressive freshness. Risk of fan-out hammering. | |

**User's choice:** SWR + thread-switch + AbortController.
**Decision:** D-086-14 + D-086-15 (explicitly no visibility/focus).

---

## Cross-cutting wrap-up

### Q: Cross-cutting choices — let Claude decide vs discuss?

| Option | Description | Selected |
|--------|-------------|----------|
| Let me decide — write CONTEXT.md | Lock SC#10 UAT, G-4 scenarios, no bug folding, no backend. | ✓ |
| Discuss UAT axes + bug folding | Walk through 4-axis matrix and bug routing decisions. | |
| Discuss G-4 lived-experience scenarios | Define operator-observable failure modes before write_context. | |

**User's choice:** Let me decide.
**Claude's decisions:**
- SC#10 4-axis UAT in full (D-086-16).
- G-4 lived-experience scenarios defined upfront — 4 concrete operator-observable scenarios (D-086-17).
- G-5 ledger checked — additive-only, no re-fire (D-086-18).
- No backend changes, no new migrations (D-086-19, D-086-20).
- 2 open + 2 deferred Agentic-RAG bugs reviewed, none folded — all outside additive store/hook scope (D-086-21).

---

## Claude's Discretion

Captured in CONTEXT.md `<decisions>` → "Claude's Discretion" section:
- Exact callback names (onTaskStart vs alternatives)
- Whether to factor a shared `usePanelReconcile` helper hook
- Number of plans (likely 2 — Planner finalizes)
- TypeScript type file location
- Cache-version bump strategy

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:
- useTaskStream(sub_run_id) drill-down hook (Phase 087)
- Single batched /panel/snapshot endpoint (v2.8)
- visibility/focus reconcile triggers for panel (re-open if staleness reported)
- User-flips-checkbox todo UX (v2.8)
- task_delta event on parent stream (re-open if bookend-only UX feels too quiet)
- 3 open Agentic-RAG bugs reviewed but not folded — routed to future polish phase
