# Phase 56: Agent Real-Time Feedback - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 56-agent-real-time-feedback
**Areas discussed:** Feedback direction, Progress granularity, Ingestion feedback, Cross-device / session continuity

---

## Feedback Direction

| Option | Description | Selected |
|--------|-------------|----------|
| Agent → user only | Surface richer visibility; user watches but cannot steer | ✓ |
| User → agent (mid-task guidance) | User interrupts loop to inject new context | |
| Both directions | Progress visibility AND mid-task steering; likely two sub-phases | |

**User's choice:** Agent → user only

---

### Feedback states to surface

| Option | Selected |
|--------|----------|
| Iteration counter | ✓ |
| Agent reasoning / thinking | ✓ |
| Skill activation | ✓ |
| Overall task phase labels | ✓ |

**User's choice:** All four states selected.

---

### Feedback display location

| Option | Description | Selected |
|--------|-------------|----------|
| Extend ToolCallPanel | Add counter, reasoning, task phase, skill rows to existing panel | ✓ |
| Separate 'Agent Activity' sidebar panel | Persistent panel independent of message thread | |
| Both — inline and persistent | ToolCallPanel + compact status strip | |

**User's choice:** Extend ToolCallPanel (Recommended)

---

### Iteration counter format

| Option | Description | Selected |
|--------|-------------|----------|
| Step N/max | "Step 3/12" | |
| Step N only | "Step 3" without maximum | ✓ |
| Progress bar showing % of max | Visual fill bar | |

**User's notes:** User asked whether max is always 12. Clarified: max is fixed at config time (12 for default, 8 for explorer) but agent stops early. "Step N/12" would be misleading because the agent often finishes at step 2–5. User agreed "Step N" with no max is correct.

---

## Progress Granularity

### Reasoning / thinking state display

| Option | Description | Selected |
|--------|-------------|----------|
| Text indicator in ToolCallPanel header | Replace "Planning next action…" with "Thinking…" | ✓ |
| Animated thought bubble / skeleton | Visual animated placeholder | |
| Show extended thinking tokens | Stream Claude reasoning tokens into collapsible block | |

**User's choice:** Text indicator (Recommended)

---

### Task phase label derivation

| Option | Description | Selected |
|--------|-------------|----------|
| Inferred from active tools (frontend logic) | Map tool names to phase labels; zero backend changes | ✓ |
| Emitted as new SSE event | Backend emits 'task_phase' event; more accurate | |
| You decide | Claude picks simplest implementation | |

**User's choice:** Inferred from active tools (Recommended)

---

### Skill activation display location

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in ToolCallPanel as a skill row | "Using skill: {name}" row with Zap icon | ✓ |
| Toast notification | Brief pop-up, disappears | |
| In message header only | Badge after stream completes | |

**User's choice:** Inline in ToolCallPanel (Recommended)

---

## Ingestion Feedback

### Granularity level

| Option | Description | Selected |
|--------|-------------|----------|
| Chunk-level progress | "Chunking 45/120 chunks" — per-chunk counters | |
| Step-level progress | 4 named stages instead of per-chunk counts | ✓ |
| Keep current 3-state model | pending/processing/completed — no changes | |

**User's choice:** Step-level progress (Recommended)

---

### Delivery mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| New 'ingestion_step' field on documents row | Backend updates field; existing Realtime subscription delivers it | ✓ |
| Separate ingestion_progress table | New table + Realtime subscription | |
| New SSE endpoint for ingestion | Separate SSE stream per upload | |

**User's choice:** New 'ingestion_step' field (Recommended)

---

### Stages

| Option | Description | Selected |
|--------|-------------|----------|
| 4 stages: extracting → chunking → embedding → metadata | Maps directly to ingest_document() stages | ✓ |
| 3 stages: extracting → embedding → done | Combines chunking with extraction | |
| 5 stages: +indexing | Adds pgvector HNSW index stage | |

**User's choice:** 4 stages (Recommended)

---

### UI display

| Option | Description | Selected |
|--------|-------------|----------|
| Replace 'processing' badge with step name | While processing, show step value instead of generic "processing" | ✓ |
| Progress bar with step label | Thin bar + step label | |
| Animated step dots | Four dots filling in | |

**User's choice:** Replace the 'processing' status badge (Recommended)

---

## Cross-Device / Session Continuity

### Behavior on tab switch / refresh

| Option | Description | Selected |
|--------|-------------|----------|
| Messages already saved — reload shows final result | Current Phase 55 behavior | |
| Realtime subscription replays missed messages | Detect completed message via messages table Realtime | ✓ |
| Show 'agent was working' indicator | Banner asking user to click to load | |

**User's choice:** Realtime subscription replays missed messages (Recommended)

---

### Subscription scope

| Option | Description | Selected |
|--------|-------------|----------|
| Current thread only | Subscribe to messages WHERE thread_id = current | ✓ |
| All threads (global subscription) | Cross-thread notifications | |

**User's choice:** Current thread only (Recommended)

---

### On detecting missed message

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-load and display silently | Message appears without user action | ✓ |
| Show 'New response available' banner | User clicks to load | |
| Trigger full message list refresh | Re-fetch entire message list | |

**User's choice:** Auto-load and display the message (Recommended)

---

## Claude's Discretion

- Exact visual styling of "Step N" counter in ToolCallPanel header
- Whether `iteration_start` is a new SSE event type or a field on an existing event
- Migration numbering and column constraints for `ingestion_step`

## Deferred Ideas

- Mid-task user steering (user injects follow-up mid-loop) — separate future phase
- Extended thinking token display (Claude reasoning tokens) — Anthropic-only, future
- Cross-thread background notifications ("Thread X finished") — requires global subscription + notification UI
- Folder-level ingestion progress — out of scope
