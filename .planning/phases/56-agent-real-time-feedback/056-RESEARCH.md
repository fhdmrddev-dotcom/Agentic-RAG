# Phase 56: Agent Real-Time Feedback - Research

**Researched:** 2026-04-28
**Domain:** SSE event loop extension, ToolCallPanel UI, Supabase Realtime, ingestion pipeline
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Agent → user only. No mid-task steering in this phase.
**D-02:** All enhanced feedback surfaces inside the existing `ToolCallPanel` component. No new sidebar panel or separate layout component.
**D-03:** Show "Step N" (no max) in the ToolCallPanel header while the agentic loop is running. Do not show "Step N/12".
**D-04:** The backend must emit a new SSE event (`iteration_start`) at the beginning of each loop iteration so the frontend can increment the counter.
**D-05:** Replace the existing `isPlanning` / "Planning next action…" state with a richer "Thinking…" text indicator in the ToolCallPanel header. Same location, better label.
**D-06:** No extended thinking token display in this phase.
**D-07:** Derive overall task phase from which tools are currently active — pure frontend logic, no new backend events:
  - `search_documents`, `query_documents`, `web_search` → "Gathering context"
  - `analyze_document` → "Analyzing"
  - `execute_code` → "Running code"
  - `load_skill` → "Loading skill"
  - When a final `delta` SSE arrives with no active tool → "Synthesizing answer"
  - Default / between tools → "Thinking…"
**D-08:** Add a dedicated "Using skill: {name}" row inside ToolCallPanel, styled similarly to existing tool rows, using the `skill_activated` SSE event that already fires. A skill icon (Zap) distinguishes it from tool rows.
**D-09:** Skill activation rows appear inline in the tool call sequence (between tool rows, in order of occurrence).
**D-10:** Add a new `ingestion_step` text column to the `documents` table. Backend updates it as stages complete inside `ingest_document()`.
**D-11:** Four stages: `extracting` → `chunking` → `embedding` → `metadata`. After metadata completes, status flips to `completed` and `ingestion_step` is no longer relevant.
**D-12:** Delivery mechanism: existing Supabase Realtime subscription on the `documents` table already fires on UPDATE events. The `ingestion_step` field arrives in the same payload — zero new infrastructure.
**D-13:** UI: while `status = 'processing'`, show `ingestion_step` value in place of the generic "processing" badge in the document list. Use the existing `StatusBadge` component.
**D-14:** Use Supabase Realtime on the `messages` table (added to `supabase_realtime` publication in Phase 55) to detect assistant messages that arrived while the user was disconnected.
**D-15:** Scope the subscription to the **current thread only** (`thread_id = active thread`). Not a global subscription.
**D-16:** On detecting a new assistant message INSERT for the current thread, auto-load and display it silently. No banner or explicit user action required.
**D-17:** The subscription is managed inside `useMessages.ts` alongside existing message-fetch logic.

### Claude's Discretion

- Exact visual styling of the "Step N" counter in the ToolCallPanel header (size, position, color — should be consistent with the existing `Clock` / duration badge pattern).
- Whether `iteration_start` is a new SSE event type or a field on an existing event.
- Migration numbering and column constraints for `ingestion_step` (nullable text, no enum — allows future stages without migration changes).

### Deferred Ideas (OUT OF SCOPE)

- Mid-task user steering
- Extended thinking token display
- Cross-thread background notifications
- Folder-level ingestion progress
</user_constraints>

---

## Summary

Phase 56 adds five distinct feedback improvements to an otherwise working system. All changes are additive — no existing behaviors are removed, only extended or replaced with richer alternatives.

The backend portion is surgical: emit one new `iteration_start` SSE event at the top of the `for iteration in range(max_iterations)` loop in `event_stream()` (threads.py line 741), and add four `ingestion_step` update calls inside `ingest_document()` (documents.py line 623). The frontend work is larger but still incremental: extend `ToolCallPanel` to consume iteration count and derive task-phase labels, add a skill activation row type alongside tool rows, and extend the Realtime subscription handling in `useMessages.ts` to silently load missed messages.

The Phase 55 Realtime race condition is the highest-risk area. The existing `useMessages.ts` (commit `e8cf7d4`) already has the Realtime subscription infrastructure. D-14–D-16 extend it but must route around the suspected root cause documented in 055-DEFERRAL.md. The recommended approach is to avoid relying on the Realtime callback to *replace* the assistant message with DB data and instead use it as a trigger to call `loadMessages()` only when the stream is provably inactive and the user is still on the relevant thread.

**Primary recommendation:** Implement in five discrete, independently testable tasks: (1) migration, (2) `iteration_start` SSE + backend ingestion steps, (3) ToolCallPanel UI changes, (4) ingestion step display in document list, (5) Realtime cross-device continuity with console.log tracing guards per the deferral's own recommendation.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Iteration counter emission | API / Backend | — | `event_stream()` in threads.py controls when each iteration begins |
| Iteration counter display | Frontend (React) | — | `ToolCallPanel` consumes the counter; pure UI state |
| Task phase label derivation | Frontend (React) | — | D-07 is pure frontend logic — no new backend events |
| Skill activation row | Frontend (React) | API / Backend | `skill_activated` SSE already emitted (threads.py line 1146); frontend renders it |
| Ingestion step updates | API / Backend | — | `ingest_document()` background task owns all stage transitions |
| Ingestion step delivery | Database / Realtime | Frontend (React) | Supabase Realtime UPDATE events carry the new column automatically |
| Ingestion step display | Frontend (React) | — | `useDocuments.ts` already patches document state on UPDATE; `StatusBadge` renders it |
| Cross-device continuity | Frontend (React) | Database / Realtime | `useMessages.ts` subscribes to Realtime INSERT; DB is the source of truth |

---

## Standard Stack

### Core (no new dependencies required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | already installed | Realtime subscriptions, postgres_changes | Already used in useDocuments and useMessages |
| React hooks | already installed | State management in ToolCallPanel and useMessages | Project standard |
| lucide-react | already installed | Zap icon for skill rows | Already imported in ToolCallPanel.tsx |
| FastAPI BackgroundTasks | already installed | ingest_document background task | Project standard |

**No new packages needed.** All required libraries are already installed. [VERIFIED: codebase grep]

---

## Architecture Patterns

### System Architecture Diagram

```
User sends message
      |
      v
backend/app/api/threads.py
  event_stream()
      |
      +-- for iteration in range(max_iterations):
      |     |
      |     +-- [NEW] yield iteration_start {iteration: N}
      |     |
      |     +-- LLM call  ──yield tool_start, tool_end, skill_activated, delta events──>
      |     |                                                                            |
      |     +-- yield planning {iteration: N}  (between iterations)                     |
      |                                                                                  |
      +-- [EXISTING] yield done, stream_end                                             |
                                                                                        v
                                                               frontend/src/lib/api.ts
                                                                 streamMessage() SSE parser
                                                                        |
                                                  +---------------------+------------------+
                                                  |                     |                  |
                                                  v                     v                  v
                                           onPlanning()        onIterationStart()   onSkillActivated()
                                                  |                     |
                                                  v                     v
                                     frontend/src/hooks/useMessages.ts
                                       setMessages({isPlanning, iterationCount, activatedSkill})
                                                  |
                                                  v
                                     frontend/src/components/chat/ToolCallPanel.tsx
                                       headerLabel: "Step N / Thinking… / Gathering context / …"
                                       SkillRow: <Zap> Using skill: {name}


Document upload path (parallel):
User uploads file
      |
      v
backend/app/api/documents.py
  ingest_document()  [background task]
      |
      +-- update status="processing"
      +-- [NEW] update ingestion_step="extracting"
      +-- chunk_text()
      +-- [NEW] update ingestion_step="chunking"
      +-- embed_chunks()
      +-- [NEW] update ingestion_step="embedding"
      +-- extract_metadata() / tables / images
      +-- [NEW] update ingestion_step="metadata"
      +-- update status="completed"
           |
           v (Supabase Realtime, existing subscription)
      frontend/src/hooks/useDocuments.ts
        UPDATE handler patches document state in-place
           |
           v
      Document list UI (existing component)
        StatusBadge shows ingestion_step while status="processing"


Cross-device continuity (parallel):
SSE drops / user navigates away
      |
      v (backend persists via asyncio.shield — Phase 55)
Supabase messages table INSERT
      |
      v (Supabase Realtime, existing channel in useMessages.ts)
useMessages.ts Realtime callback
      |
      +-- guard: isStreamingRef.current → skip (SSE live, not needed)
      +-- guard: thread_id !== activeThreadIdRef → skip (wrong thread)
      +-- else: loadMessages(currentThreadId)  [safe — no active stream]
```

### Recommended Project Structure

No new files or folders required. All changes are in-place extensions of existing files:

```
backend/
  app/api/
    threads.py        — add iteration_start SSE emit
    documents.py      — add ingestion_step updates in ingest_document()
  supabase/migrations/
    032_ingestion_step.sql   — nullable text column on documents table
frontend/
  src/
    lib/api.ts        — add onIterationStart callback to streamMessage()
    hooks/useMessages.ts  — consume onIterationStart, extend Realtime guard
    components/chat/ToolCallPanel.tsx  — Step N, task phase labels, skill rows
    types/index.ts    — add iterationCount to Message type
```

### Pattern 1: Emitting a New SSE Event Type (iteration_start)

**What:** Yield a JSON SSE event at the start of each `for iteration` loop pass.
**When to use:** When backend loop state needs to be surfaced to the frontend in real-time.

```python
# Source: threads.py — existing pattern (planning event at line 747)
for iteration in range(max_iterations):
    if stop_event.is_set():
        return
    # [NEW] Emit at the very top of each iteration (D-04)
    yield f"data: {json.dumps({'type': 'iteration_start', 'iteration': iteration})}\n\n"
    # Between tool-call rounds: signal planning state
    if iteration > 0:
        yield f"data: {json.dumps({'type': 'planning', 'iteration': iteration})}\n\n"
```

Note: `iteration_start` fires at iteration 0 (first pass) and every subsequent pass. The `planning` event already fires at `iteration > 0` — it can remain or be replaced; they serve different UX purposes (`planning` = between-tool-round thinking, `iteration_start` = the counter increment trigger).

### Pattern 2: SSE Parser Extension (api.ts)

**What:** Add `onIterationStart` callback to `streamMessage()`.
**When to use:** When a new SSE event type is introduced.

```typescript
// Source: api.ts — existing dispatch pattern (lines 159-209)
// Add to streamMessage signature:
onIterationStart?: (iteration: number) => void,

// Add to dispatch block:
} else if (parsed.type === "iteration_start" && onIterationStart) {
  onIterationStart(parsed.iteration as number)
}
```

The existing `onPlanning` callback already receives `parsed.iteration` — the same wiring pattern applies. [VERIFIED: api.ts lines 205-207]

### Pattern 3: ToolCallPanel headerLabel Extension

**What:** Replace `isPlanning → "Planning next action…"` with step counter + task phase.
**When to use:** Agentic loop is active.

```typescript
// Source: ToolCallPanel.tsx lines 501-511 — existing headerLabel logic
// BEFORE:
// if (isPlanning) return "Planning next action…"

// AFTER (D-03, D-05, D-07):
if (isPlanning || (isActivelyWorking && !activeTool)) {
  const stepPrefix = iterationCount != null ? `Step ${iterationCount + 1} — ` : ""
  return `${stepPrefix}Thinking…`
}
if (activeTool) {
  // Task phase label from tool name (D-07)
  const phase = taskPhaseLabel(activeTool.name)  // new helper
  const summary = toolSummary(activeTool)
  return summary ? `${phase} — ${summary}` : `${phase}…`
}
```

The `iterationCount` prop comes from the Message type (new field). The `taskPhaseLabel()` function maps tool names to D-07 labels and lives in `toolMeta.ts` or inline in ToolCallPanel.

### Pattern 4: Skill Activation Row

**What:** Render a dedicated row for `skill_activated` events, inline in the tool list.
**When to use:** A `skill_activated` SSE event is received.

The `activatedSkill` field already exists on the `Message` type (types/index.ts line 76). Currently it stores only the latest skill name as a string. For D-08/D-09, skills need to appear inline in sequence. This requires changing the data model: instead of a single `activatedSkill?: string`, the message needs an `activatedSkills?: SkillActivation[]` array where each entry has `{skillName: string, insertedAfterToolIndex: number}` or similar ordering marker.

**Simpler approach (recommended):** Interleave skill activations into a unified `events` array alongside tool calls, preserving SSE order. This avoids changing the persistence model since `activatedSkill` is ephemeral (not stored in DB). During streaming, build a `displayItems: Array<ToolCall | SkillActivation>` array that ToolCallPanel iterates.

```typescript
// New type in types/index.ts:
export interface SkillActivation {
  type: 'skill_activation'
  skillName: string
}

// In useMessages.ts, onSkillActivated callback (currently sets activatedSkill):
// Change to append to a displayItems array on the message:
(skillName) => {
  setMessages((prev) =>
    prev.map((m) =>
      m.id === assistantId
        ? { ...m, displayItems: [...(m.displayItems ?? []), { type: 'skill_activation', skillName }] }
        : m,
    ),
  )
},
// onToolStart: also appends to displayItems
```

**Alternative (simpler, less accurate ordering):** Keep `activatedSkill` as a side-channel field and render the skill row after all tool rows. Does not honor D-09 (inline in sequence). Rejected by decision.

### Pattern 5: Ingestion Step Updates (documents.py)

**What:** Call `supabase.table("documents").update({"ingestion_step": stage}).eq("id", document_id).execute()` at each stage boundary.
**When to use:** Inside `ingest_document()` background task.

```python
# Source: documents.py lines 623-713 — existing ingest_document()
def ingest_document(...):
    supabase.table("documents").update({"status": "processing"}).eq("id", document_id).execute()
    
    # [NEW] Stage 1
    supabase.table("documents").update({"ingestion_step": "extracting"}).eq("id", document_id).execute()
    metadata = extract_metadata(text)
    chunks = chunk_text(text)
    
    # [NEW] Stage 2
    supabase.table("documents").update({"ingestion_step": "chunking"}).eq("id", document_id).execute()
    embeddings = embed_chunks(texts_to_embed, ...)
    
    # [NEW] Stage 3
    supabase.table("documents").update({"ingestion_step": "embedding"}).eq("id", document_id).execute()
    supabase.table("document_chunks").insert(chunk_rows).execute()
    
    # Multi-modal + metadata extraction
    if raw and mime_type:
        # [NEW] Stage 4
        supabase.table("documents").update({"ingestion_step": "metadata"}).eq("id", document_id).execute()
        extract_and_store_tables(...)
        extract_and_store_images(...)
    
    supabase.table("documents").update({
        "status": "completed",
        # ingestion_step left at "metadata" or last stage; irrelevant after completed
        ...
    }).eq("id", document_id).execute()
```

Note: The current `ingest_document()` already updates `status` to `extracting_tables` and `extracting_images` (lines 694, 697). The new `ingestion_step` column is separate from `status`. Both columns coexist — `status` drives UI visibility gating; `ingestion_step` provides granular label text within `status = 'processing'`.

### Pattern 6: StatusBadge with ingestion_step (D-13)

The `StatusBadge` component in `ToolCallPanel.tsx` (lines 154-169) renders a colored pill based on a `status` string. It is used inside `LsResult` for document status display. For D-13, a parallel badge needs to render in the document list while `status = 'processing'`. The document list is a separate component from `ToolCallPanel` — the badge logic should be extracted to a shared utility or simply duplicated inline.

The display mapping per CONTEXT.md §Specifics:
- `extracting` → "Extracting"
- `chunking` → "Chunking"
- `embedding` → "Embedding"
- `metadata` → "Extracting metadata"

```typescript
function ingestionStepLabel(step: string | null | undefined): string {
  if (step === 'extracting') return 'Extracting'
  if (step === 'chunking') return 'Chunking'
  if (step === 'embedding') return 'Embedding'
  if (step === 'metadata') return 'Extracting metadata'
  return 'Processing'
}
```

### Pattern 7: Realtime Cross-Device Continuity (D-14–D-16)

The Phase 55 deferral is the critical context here. The existing `useMessages.ts` already has a Realtime subscription (commit `e8cf7d4`) with three guards in the callback:
1. `if (isStreamingRef.current) return`
2. `if (stoppedByUserRef.current) return`
3. `if ((payload.new as Message).thread_id !== activeThreadIdRef.current) return`

The deferral hypothesis A (the actual root cause) points to the `finally` block's multiple `setMessages` calls interacting with `loadMessages` state updates — not the Realtime callback itself. The guards in the callback are correct.

For D-14–D-16, the safe implementation pattern is:

```typescript
// In the Realtime INSERT callback (already exists):
if (isStreamingRef.current) return   // SSE live, don't interfere
if (payload.eventType === "INSERT") {
  const newMsg = payload.new as Message
  if (newMsg.role === "assistant" && newMsg.thread_id === activeThreadRef.current) {
    // D-16: silently merge the real DB message, replacing the temp placeholder
    setMessages((prev) => {
      const tempIdx = prev.findIndex(m => m.role === "assistant" && m.id.startsWith("temp-"))
      if (tempIdx !== -1) {
        const next = [...prev]
        next[tempIdx] = newMsg
        return next
      }
      if (prev.some(m => m.id === newMsg.id)) return prev
      return [...prev, newMsg]
    })
  }
}
```

This is already implemented in the current HEAD of `useMessages.ts`. The issue is that `isStreamingRef.current` is still `true` when the Realtime INSERT fires (backend persists before yielding `done`), so the guard correctly blocks it — but then the stream ends, `isStreamingRef.current = false` is set in `finally`, and the Realtime INSERT has already been processed and dropped.

**D-14–D-16 implementation guidance:** The Realtime subscription for cross-device continuity must remain subscribed AFTER the stream ends (for a brief window) to catch late-arriving INSERTs. The current implementation tears down the channel in `finally` immediately. The fix: delay `removeChannel()` by ~2s after stream end, so any in-flight Realtime INSERT (triggered by the backend persist that just completed) arrives before the channel closes.

```typescript
// In finally block:
isStreamingRef.current = false  // allow Realtime callbacks
// [CHANGE] Delay channel teardown to catch late Realtime INSERT
setTimeout(() => {
  if (channelRef.current) {
    supabase.removeChannel(channelRef.current)
    channelRef.current = null
  }
}, 2000)  // 2s window for late INSERT delivery
```

This directly addresses the "Stop shows full response" symptom: the Realtime INSERT fires after `isStreamingRef.current = false` but before the channel is removed, so it is now processed.

### Anti-Patterns to Avoid

- **Adding more guards to the Realtime callback without console.log tracing first.** The 055-DEFERRAL.md explicitly warns: "Do NOT add more guards to the Realtime callback without first confirming via logging that the callback is the actual source of the problem." Follow this directive.
- **Re-implementing the task phase label on the backend.** D-07 is pure frontend logic — no new SSE events needed. Avoid adding a `task_phase` field to SSE events.
- **Using `activatedSkill: string` (single value) for D-08/D-09.** Storing only the last skill name loses ordering information. Use an array in the displayItems pattern.
- **Changing the `status` column CHECK constraint** for ingestion granularity. The `ingestion_step` column is intentionally separate from `status` — adding more `status` values would break the existing status-gated UI logic.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Realtime WebSocket connection | Custom WebSocket client | `supabase.channel().on('postgres_changes', ...)` | Already used in useDocuments.ts; handles auth, reconnect, RLS automatically |
| SSE event dispatch | Custom event bus | Existing callback chain in `streamMessage()` | All SSE event types follow the same pattern — just add one more branch |
| Status badge component | Custom styled span | Existing `StatusBadge` in ToolCallPanel.tsx | Already handles completed/processing/failed colors |
| Step counter persistence | Store iterationCount in DB | Keep as ephemeral React state | Counter resets each send; not meaningful across sessions |

---

## Runtime State Inventory

Phase 56 is not a rename/refactor — this section is not applicable.

---

## Common Pitfalls

### Pitfall 1: iteration_start fires at iteration 0 — "Step 0" display

**What goes wrong:** The `for iteration in range(max_iterations)` loop starts at 0. Emitting `iteration_start` with `{iteration: 0}` and displaying "Step 0" looks wrong to users.
**Why it happens:** Python range is 0-indexed.
**How to avoid:** In the ToolCallPanel display, show `iteration + 1`: `"Step ${iterationCount + 1}"`. The backend emits 0-based; the frontend adds 1 for display.
**Warning signs:** User sees "Step 0" during the first agent pass.

### Pitfall 2: planning event and iteration_start event overlap

**What goes wrong:** The existing `planning` event fires at `iteration > 0` (line 747 of threads.py), meaning from iteration 1 onward. If `iteration_start` fires at the top of every iteration and `planning` fires just after, both fire on iterations 1+ — causing a double-update of the step counter.
**Why it happens:** Both events carry an `iteration` field. The frontend has separate callbacks for each.
**How to avoid:** `onIterationStart` increments the step counter. `onPlanning` sets `isPlanning: true` (the Thinking… indicator). They serve different purposes and can coexist — but be careful not to trigger a double increment. The step counter should only be updated from `iteration_start`, not from `planning`.
**Warning signs:** Step counter increments by 2 per iteration.

### Pitfall 3: Realtime INSERT arrives WHILE isStreamingRef is still true

**What goes wrong:** Backend yields `[DONE]` → frontend sets `isStreamingRef = false` in `finally` → Realtime INSERT fires → message is merged. But if the Realtime INSERT arrives BEFORE `isStreamingRef = false` is set (race with network latency), the guard blocks it and the INSERT is dropped. The channel is then removed immediately.
**Why it happens:** The Realtime INSERT is triggered when `_persist_assistant_message()` runs (inside `event_stream()` before yielding `done`). There is a brief window where the SSE stream is still "active" from the frontend's perspective but the backend has already persisted.
**How to avoid:** Delay `removeChannel()` by 2s after `isStreamingRef.current = false`. This window catches the late INSERT. Any INSERT after 2s is an edge case the user can manually refresh for.
**Warning signs:** Refresh after stop still shows empty / stale messages.

### Pitfall 4: ingestion_step column missing from Document TypeScript type

**What goes wrong:** The Realtime UPDATE payload includes `ingestion_step` but the `Document` type in `types/index.ts` doesn't have this field — TypeScript treats it as unknown.
**Why it happens:** DB schema change without corresponding frontend type update.
**How to avoid:** Add `ingestion_step?: string | null` to the `Document` interface in `types/index.ts`.
**Warning signs:** TypeScript errors in `useDocuments.ts` UPDATE handler; `ingestion_step` silently dropped.

### Pitfall 5: documents table needs REPLICA IDENTITY FULL for column-filtered UPDATE events

**What goes wrong:** Without `REPLICA IDENTITY FULL`, Supabase Realtime UPDATE events only include the changed columns in the OLD record if they are part of the primary key. The `useDocuments.ts` subscription correctly omits a column filter (comment on line 38: "No user_id filter here — RLS policies ensure users only receive their own rows. Adding a column filter on UPDATE events requires REPLICA IDENTITY FULL on the table").
**Why it happens:** Postgres Realtime logical replication behavior.
**How to avoid:** The schema already has `ALTER TABLE public.documents REPLICA IDENTITY FULL;` (migration 000 line 237). No action needed — `ingestion_step` UPDATE events will work correctly. [VERIFIED: migrations/000_full_schema.sql line 237]
**Warning signs:** UPDATE events arrive but `payload.new.ingestion_step` is `undefined`.

### Pitfall 6: displayItems array not cleared on loadMessages

**What goes wrong:** When `loadMessages()` replaces the temp assistant message with the DB version, the `displayItems` array (containing skill rows and tool call ordering) is not present on the DB-loaded message — DB messages only have `tool_calls`, not `displayItems`.
**Why it happens:** `displayItems` is ephemeral streaming state; it's not persisted to or loaded from DB.
**How to avoid:** The `displayItems` approach is only for live streaming display. After stream ends and message is replaced by DB version, ToolCallPanel renders from `tool_calls` (persisted). The `activatedSkill` field (also ephemeral) already has this characteristic — skills are not shown on reloaded messages. This is acceptable per D-08/D-09 which only describe live streaming behavior.
**Warning signs:** Skill rows disappear after page reload — this is expected and correct.

### Pitfall 7: ingestion_step column triggers need for migration to be idempotent

**What goes wrong:** Running the migration twice (e.g., on a fresh Supabase project that already has the column) causes an error.
**Why it happens:** `ALTER TABLE ADD COLUMN` without `IF NOT EXISTS` fails if column exists.
**How to avoid:** Use `ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ingestion_step text;` — `IF NOT EXISTS` is supported in Postgres 9.6+. [VERIFIED: pattern from migration 031_skill_embeddings.sql]

---

## Code Examples

### Full iteration_start Insertion Point

```python
# Source: backend/app/api/threads.py — verified from direct read, line 741
for iteration in range(max_iterations):
    if stop_event.is_set():
        return
    # [INSERT HERE — at the very top, before planning event]
    yield f"data: {json.dumps({'type': 'iteration_start', 'iteration': iteration})}\n\n"
    # Existing planning event (fires iteration > 0):
    if iteration > 0:
        yield f"data: {json.dumps({'type': 'planning', 'iteration': iteration})}\n\n"
```

### Realtime Subscription Channel Already Created

```typescript
// Source: useMessages.ts lines 107-151 — verified from direct read
// The channel is created in sendMessage(), filters to thread_id
const channel = supabase
  .channel(channelName)
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "messages",
    filter: `thread_id=eq.${threadId}`,
  }, (payload) => {
    if (isStreamingRef.current) return  // existing guard
    // D-16 INSERT handling already present
  })
  .subscribe()
```

### StatusBadge Existing Signature

```typescript
// Source: ToolCallPanel.tsx lines 154-169 — verified from direct read
function StatusBadge({ status }: { status: string }) {
  const color =
    status === "completed" ? "text-success" :
    status === "processing" ? "text-amber-400" :
    status === "failed" ? "text-destructive" :
    "text-muted-foreground"
  return (
    <span className={cn("ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full", color, ...)}>
      {status}
    </span>
  )
}
// For D-13: call StatusBadge with the ingestionStepLabel() value, not the raw step string
```

### SubAgentBlock Pattern (Reference for Skill Row)

```typescript
// Source: ToolCallPanel.tsx lines 447-484 — verified from direct read
// This is the model for the SkillRow component (D-08)
function SubAgentBlock({ agent }: { agent: SubAgentState }) {
  return (
    <div className="mt-3 rounded-lg overflow-hidden bg-card/40 ghost-border relative">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-violet-500" />
      <button className="w-full flex items-center gap-2.5 px-4 py-2.5 ...">
        <Zap className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />  // same Zap for skill rows
        ...
      </button>
    </div>
  )
}
// Skill row is simpler (no collapsible content) — use same Zap icon, same px-4 padding, text-violet-400
```

### TimeBadge / Duration Badge Pattern (Reference for Step Counter)

```typescript
// Source: ToolCallPanel.tsx lines 68-77 — verified from direct read
// Model for "Step N" badge placement — same location (header right side), same font class
function TimeBadge({ tc }: { tc: ToolCall }) {
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 font-mono tabular-nums flex-shrink-0">
      <Clock className="w-2.5 h-2.5" />
      {formatDuration(duration)}
    </span>
  )
}
// "Step N" badge: same class, no icon (or small Loader2 icon), text "Step N"
```

### Migration Pattern (032)

```sql
-- Source: Pattern from 031_skill_embeddings.sql (IF NOT EXISTS usage) + 027_expand_document_status.sql (documents table ALTER)
-- Migration 032: Add ingestion_step column to documents table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ingestion_step text;
-- No CHECK constraint — nullable text allows future stages without migration (per D-10 discretion)
-- No index needed — column is only read via Realtime payload, not queried directly
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `isPlanning → "Planning next action…"` | `isPlanning → "Thinking…"` with step counter | Phase 56 | Richer header; D-05 |
| No iteration visibility | "Step N" counter in header | Phase 56 | User knows progress; D-03 |
| Generic "processing" badge for all ingestion | Per-stage label (Extracting / Chunking / Embedding) | Phase 56 | User sees granular progress; D-13 |
| `skill_activated` event stored as single string | Inline skill row in ToolCallPanel | Phase 56 | Skills visible in context; D-08 |

---

## Key Discoveries from Code Inspection

### Discovery 1: messages table NOT in Realtime publication files

The `supabase/migrations/` directory has no SQL file adding `messages` to `supabase_realtime`. Migration 000 only adds `folders` and `documents`. Phase 55 Plan 055-01 added messages to the publication live (commit `5a2e237`) — this is confirmed by the DEFERRAL.md but there is no corresponding `.sql` migration file. The `000_full_schema.sql` (the canonical "fresh install" script) does not include this.

**Implication for planning:** Migration `032_ingestion_step.sql` should also include `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;` (idempotent — Postgres ignores ADD TABLE if already present in the publication) to ensure a fresh project install works correctly.

### Discovery 2: Current useMessages.ts has Realtime subscription at HEAD (commit e8cf7d4)

The current state of `useMessages.ts` already has the full Realtime subscription infrastructure. D-14–D-16 are not starting from scratch — they refine the existing implementation. The specific change needed is the delayed `removeChannel()` to catch late-arriving INSERTs. No new subscription code is required.

### Discovery 3: activatedSkill is a single string on Message type

`types/index.ts` line 76: `activatedSkill?: string`. This stores only the most recently activated skill. For D-08/D-09 (inline skill rows in sequence), either the type must be extended to an array, or a parallel `displayItems` array must track ordering. The type change is simpler; the `displayItems` approach avoids changing persistence assumptions.

### Discovery 4: documents.py already has multi-stage status updates

`ingest_document()` already updates `status` to `extracting_tables` and `extracting_images` (lines 694, 697). The new `ingestion_step` column parallels this but with different granularity labels. The existing `status` CHECK constraint (migration 027) does NOT need to be modified for Phase 56 — `ingestion_step` is a separate nullable text column.

### Discovery 5: onPlanning callback already receives iteration number

`api.ts` line 121: `onPlanning?: (iteration: number) => void`. The `planning` SSE event already carries `{iteration: N}`. This means the frontend already has the iteration number available from the `planning` event. The question for D-04 is whether to (a) reuse the existing `planning` event's iteration field or (b) add a new `iteration_start` event. Decision D-04 mandates a new event type — this is the correct choice because `planning` fires at `iteration > 0` only (between iterations), while `iteration_start` should fire at iteration 0 as well.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Delaying `removeChannel()` by 2s fixes the Phase 55 Realtime INSERT race | Common Pitfalls / Pattern 7 | If wrong, D-14–D-16 still fail; need console.log tracing per deferral recommendation |
| A2 | Messages table is already in Realtime publication on the live Supabase instance (Phase 55 commit `5a2e237`) | Discovery 1 | If not applied, D-14–D-16 receive no events; migration 032 must explicitly add it |
| A3 | `REPLICA IDENTITY FULL` on documents table ensures ingestion_step arrives in UPDATE payload | Common Pitfalls Pitfall 5 | If not set on live instance, UPDATE payloads may omit the new column |

---

## Open Questions

1. **Is the 2s `removeChannel()` delay sufficient for all network conditions?**
   - What we know: Backend persists before yielding `done`; Realtime is typically <500ms latency on Supabase
   - What's unclear: Slow networks or overloaded Supabase instances could exceed 2s
   - Recommendation: 2s is sufficient for v2.4; document as a known edge case in KNOWN-ISSUES.md

2. **Should the planning event be retained alongside iteration_start?**
   - What we know: `planning` fires at `iteration > 0`; `iteration_start` fires at all iterations; both carry iteration number
   - What's unclear: Whether `isPlanning: true` on the Message is still meaningful after D-05 replaces "Planning next action…" with "Thinking…"
   - Recommendation: Retain `planning` / `isPlanning` — it still controls the "Thinking…" indicator between tool rounds, which is separate from the step counter

3. **displayItems array vs activatedSkills array for D-08/D-09**
   - What we know: Both approaches work; `displayItems` is more flexible
   - What's unclear: Whether skill rows need to persist across page reload (they don't, per D-08 — ephemeral)
   - Recommendation: Use the simpler `activatedSkills: SkillActivation[]` array on Message type, ordered by arrival time, without the full displayItems refactor

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies. All changes are in-place code/config modifications using already-installed libraries.

---

## Validation Architecture

`workflow.nyquist_validation` is not set to `false` in `.planning/config.json` — validation section is included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (backend) + manual browser verification (frontend) |
| Config file | `backend/pytest.ini` or project root |
| Quick run command | `cd backend && python -m pytest tests/unit/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -x -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-04 | `iteration_start` event emitted at every iteration | unit | `pytest tests/unit/test_streaming_reliability.py -k iteration_start -x` | ❌ Wave 0 |
| D-10/D-11 | `ingestion_step` column updated at each stage in `ingest_document()` | unit | `pytest tests/unit/test_ingestion.py -k ingestion_step -x` | ❌ Wave 0 |
| D-12 | Realtime UPDATE payload includes `ingestion_step` | manual | browser: upload file, observe document list badges | manual-only |
| D-14/D-16 | Refreshing page after stream loads assistant message | manual | browser: send message, close tab, reopen | manual-only |
| D-03/D-05/D-07 | Step counter and task phase labels display correctly | manual | browser: send multi-step query, observe ToolCallPanel header | manual-only |
| D-08/D-09 | Skill row appears inline after `skill_activated` | manual | browser: send query that triggers a skill | manual-only |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/unit/ -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x -q`
- **Phase gate:** Backend unit tests green + manual browser verification of all 6 behaviors before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_streaming_reliability.py` — add `test_iteration_start_event` test case (can extend existing file from Phase 55)
- [ ] `backend/tests/unit/test_ingestion.py` — add `test_ingestion_step_updates` test case (mock supabase.table calls, assert ingestion_step is set at each stage)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | RLS on documents and messages tables; Supabase Realtime filter scoped to thread_id / RLS |
| V5 Input Validation | yes | `ingestion_step` is set by backend only (never user input); Realtime payloads are read-only by frontend |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Realtime message injection — forged Realtime INSERT for another user's thread | Spoofing | Supabase RLS on messages table ensures users only receive their own rows; frontend `thread_id` filter is defense-in-depth |
| `ingestion_step` column injection via malicious filename | Tampering | Backend sets `ingestion_step` value from hardcoded strings only (`"extracting"`, `"chunking"`, etc.) — never from user-supplied input |
| Cross-thread message leak via Realtime subscription | Information Disclosure | Subscription filter `thread_id=eq.{threadId}` + RLS; frontend guard checks `payload.new.thread_id` |

---

## Sources

### Primary (HIGH confidence)
- `backend/app/api/threads.py` — verified complete `event_stream()` loop, SSE event types, `planning` event at line 747, `skill_activated` at line 1146, `iteration` range structure
- `frontend/src/components/chat/ToolCallPanel.tsx` — verified `headerLabel` logic, `SubAgentBlock`, `TimeBadge`, `StatusBadge`, `isPlanning` prop, `Zap` import
- `frontend/src/lib/toolMeta.ts` — verified `toolLabel()` and `toolSummary()` registry
- `frontend/src/lib/api.ts` — verified `streamMessage()` signature, all SSE event dispatch branches, `onPlanning` at line 205
- `frontend/src/hooks/useMessages.ts` — verified Realtime subscription at commit e8cf7d4, `isStreamingRef` guard, `channelRef` lifecycle in `finally`
- `frontend/src/hooks/useDocuments.ts` — verified UPDATE event handler patches state in-place
- `backend/app/api/documents.py` — verified `ingest_document()` stages, existing `status` updates at lines 635, 694, 697, 700
- `frontend/src/types/index.ts` — verified `ToolCall`, `SubAgentState`, `Message`, `Document` types including `activatedSkill?: string`
- `supabase/migrations/000_full_schema.sql` — verified `REPLICA IDENTITY FULL` on documents (line 237), messages table columns, no `messages` in Realtime publication
- `supabase/migrations/027_expand_document_status.sql` — verified documents status CHECK constraint
- `supabase/migrations/031_skill_embeddings.sql` — verified `IF NOT EXISTS` pattern for column migration
- `.planning/phases/055-streaming-reliability-connection-resilience/055-DEFERRAL.md` — verified all 5 fix attempts, hypothesis A (React state ordering), recommendation to add console.log tracing

### Secondary (MEDIUM confidence)
- `.planning/phases/056-agent-real-time-feedback/056-CONTEXT.md` — user decisions and code context insights

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as already installed; no new dependencies
- Architecture: HIGH — all insertion points verified by direct code inspection
- Pitfalls: HIGH (discovered by code reading) / MEDIUM (A1 Realtime timing assumption)
- D-14–D-16 implementation: MEDIUM — deferred from Phase 55 with multiple failed attempts; new approach (delayed removeChannel) is hypothesis-based

**Research date:** 2026-04-28
**Valid until:** 2026-06-28 (stable stack; frontend types and backend patterns are project-specific and change only with code changes)
