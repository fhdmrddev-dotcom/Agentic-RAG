# Phase 224: What the Agent Is Doing Reads Like a Sentence - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase addresses how the agent's activity is expressed in the chat column and workspace panel so that what the agent does reads in words a person would use, without orphaned controls, raw machine identifiers, or unreachable approval clocks.

Scope anchors (from `224-PROPOSAL.md §SCOPE CHANGE 2026-09-02` and `224-PREFLIGHT.md`):
1. **Delete `SeamCard`'s `write_todos` and `workspace_write` arms.** `ask_user` survives as the durable record of operator decisions.
2. **Chat imports `TOOL_PHRASES`** via shared `toolName` so no raw machine identifiers (`WRITE_TODOS`, `WORKSPACE_WRITE`) reach users.
3. **Move status line inside the `RunCard` frame** and render each step's result in a right-aligned column.
4. **Drop `<Square>` glyph** on "Agent reached time limit" and "Response stopped" — render plain muted italic text.
5. **Dock approval card above `MessageInput`** while pending, with fallback jump chip if out of view, and put the deadline on the wire (`expires_at` ISO 8601 UTC timestamp on `ToolApprovalRequest`).
6. **`BUG-260902-07`**: References folded by default in `MessageItem.tsx` (reversing Phase 153 D-06/D-07), with a shared subtle bordered pill/badge fold trigger across `CitationList.tsx` and `RunCard.tsx` Thinking block (Thinking block default remains folded `useState(false)`).
7. **Fix panel todo row layout wrap at 308px floor** in `TodosSection.tsx` so the badge does not dictate premature wrap points.

</domain>

<decisions>
## Implementation Decisions

### 1. Approval Card Docking & Wire Deadline
- **D-224-01:** Single source for approval timeout & clock skew immunity:
  - Define `_APPROVAL_TIMEOUT_SECONDS = 120.0` as a single module-level constant in `backend/app/services/tool_dispatcher.py`. Both `asyncio.wait_for(..., timeout=_APPROVAL_TIMEOUT_SECONDS)` and `now_utc + timedelta(seconds=_APPROVAL_TIMEOUT_SECONDS)` consume this single constant.
  - On the wire, `ctx.emit("tool_approval_required", ...)` transmits BOTH `expires_at` (ISO 8601 UTC timestamp) and `timeout_seconds: float = _APPROVAL_TIMEOUT_SECONDS`.
  - The client prefers `timeoutSeconds` to anchor the countdown locally (`Date.now() + timeoutSeconds * 1000`), with fallback to `Date.parse(expiresAt)`. This makes the countdown completely immune to client-server clock skew while still preserving absolute timestamps for audit/replay.
  - Tests import `_APPROVAL_TIMEOUT_SECONDS` and assert directly against it, not against an independent literal or float tolerance.
- **D-224-02:** Docking & transition: While pending, the approval card docks directly above `MessageInput` in `ChatArea.tsx` (always visible in viewport). Once decided or timed out, the card immediately transitions into the message transcript as a historic record. If scrolled away, the jump chip serves as a triggered fallback.

### 2. SeamCard Cleanup & Tool Vocabulary
- **D-224-03:** Shared tool vocabulary: Re-export `toolName` from `@/lib/toolNames.ts` (re-exporting from `components/workflows/toolNames.ts`) so both Chat and Workflows import human-readable action phrases ("Track its to-dos", "Write a file", etc.) without cross-domain boundary leakage.
- **D-224-04:** SeamCard arm deletion: Remove `write_todos` and `workspace_write` arms from `SeamCard.tsx` and associated tests in `Seam.test.tsx`, preserving `ask_user`. (Note: `Seam.test.tsx` was verified to not be in `TARGETS` or `BASELINE`, so there is no existing count-gate pin to decrease; adoption into the gate is handled in Plan 224-05).

### 3. RunCard Composition & Status Indicator
- **D-224-05:** Status indicator styling: Drop the `<Square>` checkbox glyph entirely in `MessageItem.tsx`. Render "Agent reached time limit" and "Response stopped" as plain muted italic text without control-like glyphs.
- **D-224-06:** Step results layout: Move the status line inside the `RunCard` frame. Step actions align on the left (tool icon + human phrase) and results/timing align in a right-aligned column (`flex items-center justify-between`).

### 4. Fold Affordances & Panel Todo Wrap
- **D-224-07:** Shared fold trigger & default states:
  - References footer in `MessageItem.tsx` folds by default (`defaultOpen={false}`, consciously reversing Phase 153 D-06/D-07).
  - Implement a shared fold trigger affordance (subtle bordered pill/badge: `border border-border/50 bg-muted/30 hover:bg-muted/60 rounded px-2 py-0.5 text-xs text-muted-foreground font-medium flex items-center gap-1.5`) used in both `CitationList.tsx` and `RunCard.tsx` (Thinking fold).
  - `RunCard.tsx` Thinking fold default remains `useState(false)` (do not alter its default state).
- **D-224-08:** Todo row wrap layout: In `TodosSection.tsx`, let `todo.content` take full available width (`flex-1 min-w-0`), placing status text on a subtle secondary line beneath the content when long so sentences do not wrap prematurely at the 308px panel floor.
- **D-224-09:** Count gate adoption for touched suites: In Plan 224-05, adopt the test suites touched and created in this phase (`Seam.test.tsx` at 8 tests, `TodosSection.test.tsx`, etc.) into `TARGETS` and `BASELINE` in `scripts/vitest-count-gate.cjs` (matching Phase 214 practice), ensuring these chat/panel surfaces are actively guarded against regression rather than remaining ungated.

### Claude's Discretion
- Exact Tailwind utility classes for the docked approval card shadow and border styling in `ChatArea.tsx`.
- Fallback text formatting for unmapped tool names in `toolName()` (`tool.replace(/_/g, ' ')` or raw id per docblock).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & Acceptance Bars
- `.planning/phases/224-what-the-agent-is-doing-reads-like-a-sentence/224-PROPOSAL.md` §`SCOPE CHANGE 2026-09-02` — Superseded scope contract and rationale
- `.planning/phases/224-what-the-agent-is-doing-reads-like-a-sentence/224-PREFLIGHT.md` — Pre-flight measurements and hazards
- `.planning/sketches/223-the-step-inside-the-run/index.html` — Approved Winner D (delete SeamCard arms)
- `.planning/sketches/226-the-card-you-can-reach-and-its-clock/index.html` — Approved Winner A (dock above composer with B fallback)

### Codebase Implementations
- `frontend/src/components/workflows/toolNames.ts` — `TOOL_PHRASES` and `toolName()` helper
- `frontend/src/components/chat/ChatToolApprovalCard.tsx` — Pending approval card and `ToolApprovalRequest`
- `frontend/src/components/chat/RunCard.tsx` — Run frame, Thinking collapsible, and status line
- `frontend/src/components/chat/MessageItem.tsx` — SeamCard rendering, citation `defaultOpen`, and status text
- `frontend/src/components/chat/CitationList.tsx` — Citation list and toggle trigger
- `frontend/src/components/panel/TodosSection.tsx` — Workspace todo row layout
- `backend/app/services/tool_dispatcher.py` — Approval pause and timeout dispatch

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `toolName()` in `frontend/src/components/workflows/toolNames.ts`: Safe `own()` dictionary lookup for human phrases.
- `ChatToolApprovalCard.tsx`: Approval card component with `onApprove` / `onReject` actions.

### Established Patterns
- `StreamsProvider.tsx`: Pure read over persisted chat `tool_calls` for workspace panel derived state.
- `SeamCard.tsx`: Historic marker in transcript for human interactions (`ask_user`).

### Integration Points
- `ChatArea.tsx`: Mount point for the docked approval card above `MessageInput`.
- `ToolApprovalRequest` wire type in `frontend/src/types/index.ts` (or `ChatToolApprovalCard.tsx`) and backend dispatch payload in `tool_dispatcher.py`.

</code_context>

<specifics>
## Specific Ideas
- The approval countdown must feel calm and clear, ticking down in seconds without jarring UI shifts.
- The shared fold affordance should feel integrated into the Midnight design palette, not like an unstyled link.

</specifics>

<deferred>
## Deferred Ideas

- **`SEED-128`**: Claude.ai-style collapsible run/reasoning timeline (planted for future milestone per operator direction).
- **`BUG-260902-01`**: Backend write for abandoned todo state (drawing sketched, data write belongs to dedicated phase).
- **`BUG-260902-06`**: Per-worker cache (unrelated to chat presentation).

</deferred>

---

*Phase: 224-what-the-agent-is-doing-reads-like-a-sentence*
*Context gathered: 2026-09-02*
