# Phase 56: Agent Real-Time Feedback - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Richer real-time visibility of what the agent is doing — iteration progress, task phase labeling, skill activation display, and ingestion step progress — all surfaced to the user through the existing ToolCallPanel and document list UI.

This phase is **agent → user feedback only**. No mid-task steering/interruption by the user. The user watches with more granular insight; they do not redirect the agent during a running stream.

Also includes reconnect resilience: when the user refreshes or switches tabs during an active stream, the Supabase Realtime subscription on the messages table (added in Phase 55) detects the completed assistant message and auto-loads it.

</domain>

<decisions>
## Implementation Decisions

### Feedback Direction
- **D-01:** Agent → user only. No mid-task steering in this phase — that is a separate future capability.
- **D-02:** All enhanced feedback surfaces inside the existing `ToolCallPanel` component. No new sidebar panel or separate layout component.

### Iteration Counter
- **D-03:** Show "Step N" (no max) in the ToolCallPanel header while the agentic loop is running. Do not show "Step N/12" — the agent often finishes well before the max, which makes a fixed denominator misleading.
- **D-04:** The backend must emit a new SSE event (e.g., `iteration_start`) at the beginning of each loop iteration so the frontend can increment the counter.

### Agent Reasoning State
- **D-05:** Replace the existing `isPlanning` / "Planning next action…" state with a richer "Thinking…" text indicator in the ToolCallPanel header. Same location, better label.
- **D-06:** No extended thinking token display in this phase (Claude reasoning tokens are a separate future feature).

### Task Phase Labels
- **D-07:** Derive overall task phase from which tools are currently active — pure frontend logic, no new backend events:
  - `search_documents`, `query_documents`, `web_search` → "Gathering context"
  - `analyze_document` → "Analyzing"
  - `execute_code` → "Running code"
  - `load_skill` → "Loading skill"
  - When a final `delta` SSE arrives with no active tool → "Synthesizing answer"
  - Default / between tools → "Thinking…"

### Skill Activation Display
- **D-08:** Add a dedicated "Using skill: {name}" row inside ToolCallPanel, styled similarly to existing tool rows, using the `skill_activated` SSE event that already fires. A skill icon (Zap) distinguishes it from tool rows.
- **D-09:** Skill activation rows appear inline in the tool call sequence (between tool rows, in order of occurrence).

### Ingestion Step Progress
- **D-10:** Add a new `ingestion_step` text column to the `documents` table. Backend updates it as stages complete inside `ingest_document()`.
- **D-11:** Four stages: `extracting` → `chunking` → `embedding` → `metadata`. After metadata completes, status flips to `completed` and `ingestion_step` is no longer relevant.
- **D-12:** Delivery mechanism: existing Supabase Realtime subscription on the `documents` table already fires on UPDATE events. The `ingestion_step` field arrives in the same payload — zero new infrastructure.
- **D-13:** UI: while `status = 'processing'`, show `ingestion_step` value in place of the generic "processing" badge in the document list. Use the existing `StatusBadge` component.

### Cross-Device / Session Continuity
- **D-14:** Use Supabase Realtime on the `messages` table (added to `supabase_realtime` publication in Phase 55) to detect assistant messages that arrived while the user was disconnected.
- **D-15:** Scope the subscription to the **current thread only** (`thread_id = active thread`). Not a global subscription.
- **D-16:** On detecting a new assistant message INSERT for the current thread, auto-load and display it silently. No banner or explicit user action required.
- **D-17:** The subscription is managed inside `useMessages.ts` alongside existing message-fetch logic.

### Claude's Discretion
- Exact visual styling of the "Step N" counter in the ToolCallPanel header (size, position, color — should be consistent with the existing `Clock` / duration badge pattern).
- Whether `iteration_start` is a new SSE event type or a field on an existing event.
- Migration numbering and column constraints for `ingestion_step` (nullable text, no enum — allows future stages without migration changes).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Streaming Architecture
- `frontend/src/components/chat/ToolCallPanel.tsx` — Primary component to extend: iteration counter, task phase labels, skill rows, "Thinking…" state
- `frontend/src/lib/toolMeta.ts` — Tool label/summary helpers; must be updated if new tool names or phase labels are introduced
- `backend/app/api/threads.py` — `event_stream()` agentic loop — source of all SSE events; `iteration_start` event must be emitted here
- `frontend/src/lib/api.ts` — `streamMessage()` SSE parser; must handle new `iteration_start` event type

### Ingestion Pipeline
- `backend/app/api/documents.py` — `ingest_document()` background task — where `ingestion_step` updates must be added
- `frontend/src/hooks/useDocuments.ts` — Realtime subscription for `documents` table; receives `ingestion_step` in UPDATE events
- `supabase/migrations/` — Migration needed for `ingestion_step` column on `documents` table

### Cross-Device Continuity
- `frontend/src/hooks/useMessages.ts` — Where Realtime subscription for `messages` table (Phase 55 work) lives; `D-17` extends this
- `.planning/phases/055-streaming-reliability-connection-resilience/055-DEFERRAL.md` — Documents the Phase 55 Realtime race condition; planner must be aware of this when extending the messages subscription

### Types
- `frontend/src/types/index.ts` — `ToolCall`, `SubAgentState` types; may need extension for skill activation rows and iteration counter

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ToolCallPanel` (`frontend/src/components/chat/ToolCallPanel.tsx`): The component to extend. Already has `isPlanning` prop (maps to D-05), `SubAgentBlock` inline component (pattern for D-08 skill rows), shimmer progress bar, `headerLabel` logic (maps to D-07 task phase labels), `TimeBadge` / duration display (pattern for D-03 step counter).
- `StatusBadge` component inside `ToolCallPanel.tsx`: Already handles colored status labels — reuse for `ingestion_step` display in document list (D-13).
- `toolLabel()` and `toolSummary()` in `toolMeta.ts`: Central registry for tool display names — extend for phase label mapping (D-07).
- `useDocuments.ts` Realtime subscription: Already subscribes to `documents` UPDATE events and patches in-place. `ingestion_step` arrives for free in the UPDATE payload (D-12).
- `useMessages.ts`: Phase 55 added partial Realtime subscription infrastructure here. D-17 extends this.

### Established Patterns
- SSE event dispatch: `streamMessage()` in `api.ts` dispatches by event type with callbacks. New `iteration_start` event follows the same pattern as `tool_start`, `skill_activated`, etc.
- Supabase Realtime via `postgres_changes`: Used for both `documents` (useDocuments) and `messages` (useMessages from Phase 55). Same subscription pattern for D-14.
- `isPlanning` prop: Backend sets this when the agent has finished a tool round and is deciding next action. The new "Step N / Thinking…" state replaces this display.

### Integration Points
- `event_stream()` in `threads.py`: Must emit `iteration_start` at the top of the `for iteration in range(max_iterations)` loop.
- `ingest_document()` in `documents.py`: Must call `supabase.table("documents").update({"ingestion_step": "extracting"}).eq("id", doc_id)` at each stage.
- `ToolCallPanel` `headerLabel` logic: Current `if isPlanning → "Planning next action…"` block is where task phase labels and step counter are wired in.

</code_context>

<specifics>
## Specific Ideas

- The iteration counter ("Step N") should be styled consistently with the existing `Clock` + duration badge in the ToolCallPanel header — small, monospace, secondary prominence.
- Skill rows inside ToolCallPanel should use `Zap` icon (already imported in ToolCallPanel) to distinguish from tool rows which use tool-specific icons.
- Ingestion step labels in the badge should be title-cased for display: `extracting` → `Extracting`, `chunking` → `Chunking`, `embedding` → `Embedding`, `metadata` → `Extracting metadata`.
- Phase 55 Realtime race condition (INSERT race in useMessages.ts) is documented but unresolved. Planner must design D-14–D-16 to be resilient to the race or route around the exact code path that caused it.

</specifics>

<deferred>
## Deferred Ideas

- **Mid-task user steering** — user injects a follow-up message mid-agentic-loop ("stop, use the files you already found"). Architecture requires pausing the agentic loop and injecting new context. Future phase.
- **Extended thinking token display** — streaming Claude reasoning tokens into a collapsible "Reasoning" block. Anthropic-only, future phase.
- **Cross-thread background notifications** — "your agent task in Thread X finished". Would require global messages subscription + notification UI. Future phase.
- **Folder-level ingestion progress** — per-folder ingest queue status. Out of scope.
- **Phase 56 Realtime diagnostic console.log cleanup** — Plan 03 Task 3 adds `[Phase56-Realtime]` console.log statements to useMessages.ts (loadMessages, clearMessages, finally, Realtime callback, delayed removeChannel) per 055-DEFERRAL.md mandate. These are diagnostic-only and must be removed in a follow-up phase once the D-14/D-16 reconnect race is verified fixed. Tracked here so the cleanup is not lost.

</deferred>

---

*Phase: 56-agent-real-time-feedback*
*Context gathered: 2026-04-28*
