# Phase 224: What the Agent Is Doing Reads Like a Sentence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-02
**Phase:** 224-what-the-agent-is-doing-reads-like-a-sentence
**Areas discussed:** Approval card docking & wire deadline, SeamCard cleanup & tool vocabulary, RunCard internal frame & step results, Fold affordances & panel todo wrap

---

## 1. Approval Card Docking & Wire Deadline

| Option | Description | Selected |
|--------|-------------|----------|
| ISO 8601 UTC timestamp (`expires_at`) | Computed at pause time on backend, forwarded on `ToolApprovalRequest`; client countdown anchored to `Date.now()` on arrival | ✓ |
| Unix epoch milliseconds (`expires_at_ms`) | Epoch timestamp | |
| Relative duration only (`timeout_seconds: 120`) | Client starts timer upon receipt | |

| Transition Option | Description | Selected |
|-------------------|-------------|----------|
| Dock above MessageInput, resolve into transcript | Dock directly above `MessageInput` while pending; upon decision or timeout, resolve immediately into message transcript | ✓ |
| Stay docked after decision | Remain docked showing outcome badge until next turn begins | |

**User's choice:** ISO 8601 UTC timestamp (`expires_at`) on wire; dock directly above `MessageInput` while pending, resolving immediately into the message transcript upon decision or timeout.
**Notes:** Anchoring client countdown against `Date.now()` prevents server constant duplication and clock drift.

---

## 2. SeamCard Cleanup & Tool Vocabulary

| Sharing Option | Description | Selected |
|----------------|-------------|----------|
| Re-export from `@/lib/toolNames.ts` | Shared dictionary without cross-domain leakage between Workflows and Chat | ✓ |
| Direct import from workflows | Import `toolName` directly from `@/components/workflows/toolNames` | |

| SeamCard Deletion Option | Description | Selected |
|--------------------------|-------------|----------|
| Strip arms, tests, and re-pin gate | Strip `write_todos` and `workspace_write` arms and tests in `SeamCard.tsx`/`Seam.test.tsx`, preserve `ask_user`, re-pin count gate | ✓ |
| Pass-through stubs | Retain deprecated stubs returning null | |

**User's choice:** Re-export `toolName` from `@/lib/toolNames.ts`; cleanly delete `write_todos` and `workspace_write` arms and dead tests while preserving `ask_user`, re-pinning count gate in the same commit.
**Notes:** `useDerivedPanel` already provides pure reads over persisted chat `tool_calls` and `FilesSection` fetches from the server, making `SeamCard` duplicate cards redundant. `ask_user` remains the necessary transcript record of user choices.

---

## 3. RunCard Composition & Status Indicator

| Glyph Option | Description | Selected |
|--------------|-------------|----------|
| Drop `<Square>` glyph entirely | Render plain muted italic text for status indicators ("Agent reached time limit" / "Response stopped") | ✓ |
| Replace with status icon | Use Clock or AlertCircle icon | |

| Results Alignment Option | Description | Selected |
|--------------------------|-------------|----------|
| 2-column flex layout | Action left-aligned (tool icon + human phrase), result/timing right-aligned inside run frame | ✓ |
| Stacked layout | Stack results beneath action name | |

**User's choice:** Drop `<Square>` glyph entirely; render step action left-aligned and result/timing right-aligned inside the `RunCard` frame.
**Notes:** Eliminates the confusing checkbox-like glyph on terminal limit status lines.

---

## 4. Fold Affordances & Panel Todo Wrap

| Trigger Styling Option | Description | Selected |
|------------------------|-------------|----------|
| Subtle bordered badge/pill | `border border-border/50 bg-muted/30 hover:bg-muted/60 rounded px-2 py-0.5 text-xs text-muted-foreground font-medium flex items-center gap-1.5` shared across CitationList and RunCard Thinking fold | ✓ |
| Text button with underline hover | Minimal link-style button | |

| Todo Wrap Option | Description | Selected |
|------------------|-------------|----------|
| Full-width content, secondary line status | Status indicator on left, content takes full width (`flex-1 min-w-0`), status text on secondary line when multi-line | ✓ |
| Abbreviated side badge | Compress badge text to preserve horizontal room | |

**User's choice:** Subtle bordered badge/pill shared across `CitationList` and `RunCard` Thinking fold; `todo.content` takes full width with status text on secondary line when multi-line to prevent premature wrapping at the 308px panel floor.
**Notes:** Reverses Phase 153 D-06/D-07 contract consciously so References fold by default in `MessageItem.tsx`. Thinking block default remains folded (`useState(false)` unchanged).

---

## Claude's Discretion

- Tailwind shadow and border polish on docked approval card.
- Fallback phrase derivation for unregistered tools.

---

## Deferred Ideas

- **`SEED-128`**: Collapsible run/reasoning timeline (planted for future milestone).
- **`BUG-260902-01`**: Backend write for abandoned todo status.
- **`BUG-260902-06`**: Per-worker cache.
