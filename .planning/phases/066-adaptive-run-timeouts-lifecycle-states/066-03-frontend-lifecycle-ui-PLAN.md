---
phase: 066-adaptive-run-timeouts-lifecycle-states
plan: 03
type: execute
wave: 2
depends_on: ["01"]
files_modified:
  - frontend/src/types/index.ts
  - frontend/src/lib/api.ts
  - frontend/src/hooks/useMessages.ts
  - frontend/src/components/chat/MessageItem.tsx
autonomous: true
requirements:
  - STREAM-04-polish

must_haves:
  truths:
    - "Frontend Message.runStatus type admits 5 values: streaming, completed, failed, cancelled, timed_out"
    - "api.ts mapper for getMessages accepts run_status='timed_out' from backend without dropping or coercing"
    - "subscribeToRun's StreamCallbacks.onTerminal kind type admits a 4th value 'timed_out' (was 3 — done|error|cancelled)"
    - "subscribeToRun parser handles t === 'timed_out' SSE event by calling onTerminal('timed_out') and returning"
    - "useMessages.ts terminal-event mapping (sendMessage AND reconcile callsites) gains a 5th branch BEFORE the cancelled fallback that sets runStatus='timed_out' and stopped=true"
    - "MessageItem.tsx Resume button gating extends from runStatus === 'failed' to runStatus === 'failed' || runStatus === 'timed_out'"
    - "MessageItem.tsx stopped-banner copy switches on runStatus: 'Response stopped' (cancelled) | 'Agent reached time limit' (timed_out) | existing failed copy"
    - "TypeScript compilation succeeds with no errors after all changes"
  artifacts:
    - path: "frontend/src/types/index.ts"
      provides: "Message.runStatus 5-value union type"
      contains: '"timed_out"'
    - path: "frontend/src/lib/api.ts"
      provides: "5-value run_status Pydantic mirror in getMessages mapper + onTerminal kind 4th value + subscribeToRun parser branch for t === 'timed_out'"
      contains: 'onTerminal: (kind: "done" | "error" | "cancelled" | "timed_out"'
    - path: "frontend/src/hooks/useMessages.ts"
      provides: "5th onTerminal branch in BOTH sendMessage and reconcile callsites — sets runStatus='timed_out'"
      contains: 'kind === "timed_out"'
    - path: "frontend/src/components/chat/MessageItem.tsx"
      provides: "Resume button gating extended to timed_out + banner copy switch on runStatus"
      contains: 'runStatus === "timed_out"'
  key_links:
    - from: "Backend SSE wire (Plan 01 D-066-06): TERMINAL_TYPES adds 'timed_out'"
      to: "subscribeToRun parser branch + onTerminal kind type union"
      via: "wire-format byte match — backend emits {type:'timed_out'} → frontend parser dispatches to onTerminal('timed_out')"
      pattern: 't === "timed_out"'
    - from: "useMessages.ts onTerminal('timed_out') callback"
      to: "MessageItem.tsx Resume button + 'Agent reached time limit' banner"
      via: "setMessages updater writes runStatus='timed_out'; MessageItem switch keys on m.runStatus"
      pattern: 'runStatus: "timed_out"'
---

<objective>
Mirror Plan 01's backend lifecycle split on the frontend (D-066-09, 10). Five touchpoints:
1. `frontend/src/types/index.ts:97-98` — `Message.runStatus` union extends to 5 values.
2. `frontend/src/lib/api.ts:73` — Pydantic mirror in `getMessages` mapper extends; `StreamCallbacks.onTerminal` kind type union extends from 3 to 4 values; `subscribeToRun` parser dispatches `t === "timed_out"` events to `onTerminal("timed_out")`.
3. `frontend/src/hooks/useMessages.ts:567-572 + 791-803` — both `onTerminal` overrides (sendMessage path and reconcile path) gain a 5th branch BEFORE the cancelled fallback.
4. `frontend/src/components/chat/MessageItem.tsx:101` — Resume button gating from `runStatus === "failed"` to `runStatus === "failed" || runStatus === "timed_out"`.
5. `frontend/src/components/chat/MessageItem.tsx:130-145` — stopped-banner copy switches on `runStatus`: `cancelled` → "Response stopped"; `timed_out` → "Agent reached time limit"; `failed` → existing copy.

Purpose: Without this plan, even with the backend correctly writing `runs.status='timed_out'` and emitting a `{type:'timed_out'}` SSE sentinel, the frontend would either drop the event silently or fall into the cancelled fallback (showing "Response stopped" — wrong). Plan 03 makes the user-visible lifecycle distinction real.

**Vitest deferral note:** Per Phase 063.1 plan precedent (vitest unavailable on this machine due to npm optional-dep cascade — `@rolldown/binding-win32-x64-msvc` + `@jridgewell/sourcemap-codec`), runtime test execution defers to CI / fresh `npm install` env. Plan 03's gate is **TypeScript compilation green** (`npm run typecheck` or `tsc --noEmit`); behavior verification happens in Plan 05 live UAT.

Output: 4 frontend files modified; tsc compile passes; one commit.
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Vibe Apps/Agentic RAG/.planning/PROJECT.md
@C:/Vibe Apps/Agentic RAG/.planning/ROADMAP.md
@C:/Vibe Apps/Agentic RAG/.planning/STATE.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-RESEARCH.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-01-SUMMARY.md
@C:/Vibe Apps/Agentic RAG/CLAUDE.md
@C:/Vibe Apps/Agentic RAG/frontend/src/types/index.ts
@C:/Vibe Apps/Agentic RAG/frontend/src/lib/api.ts
@C:/Vibe Apps/Agentic RAG/frontend/src/hooks/useMessages.ts
@C:/Vibe Apps/Agentic RAG/frontend/src/components/chat/MessageItem.tsx

<interfaces>
<!-- Existing contracts the executor MUST preserve. -->

From frontend/src/types/index.ts:97-98 (CURRENT 4-value union — extend to 5):
```typescript
/** Phase 063 (D-063-04): lifecycle status of the underlying run. Mirrors public.runs.status enum values. ... */
runStatus?: "streaming" | "completed" | "failed" | "cancelled"
```

From frontend/src/lib/api.ts:73 (CURRENT 4-value type assertion in getMessages mapper):
```typescript
run_status?: "streaming" | "completed" | "failed" | "cancelled" | null
```

From frontend/src/lib/api.ts:163-168 (CURRENT 3-value onTerminal kind union):
```typescript
/** Phase 063: callback shape for subscribeToRun. ... `onTerminal` callback that handles Phase 062 TERMINAL_TYPES (done | error | cancelled). */
export interface StreamCallbacks {
  onDelta: (text: string) => void
  onDone: () => void
  onTerminal: (kind: "done" | "error" | "cancelled", error?: string) => void
  ...
}
```

From frontend/src/lib/api.ts:362-388 (CURRENT subscribeToRun parser — 3 terminal branches; ADD 'timed_out'):
```typescript
        else if (t === "done") {
          if (!doneFired) {
            doneFired = true
            callbacks.onDone()
          }
        } else if (t === "suggestions" && callbacks.onSuggestions) {
          callbacks.onSuggestions((parsed.questions ?? []) as string[])
        } else if (t === "stream_end") {
          callbacks.onTerminal("done")
          return
        } else if (t === "error") {
          callbacks.onTerminal("error", parsed.error as string | undefined)
          return
        } else if (t === "cancelled") {
          callbacks.onTerminal("cancelled")
          return
        }
        // ... non-terminal branches ...
```

From frontend/src/hooks/useMessages.ts:561-572 (CURRENT sendMessage onTerminal override — 3 branches; ADD 5th `timed_out` BEFORE cancelled fallback):
```typescript
      callbacks.onTerminal = (kind, errorPayload) => {
        // Map TERMINAL_TYPES → runStatus enum value (literal-per-branch so future
        // greps for `runStatus: "<value>"` find every branch).
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            if (kind === "done") return { ...m, runStatus: "completed" }
            if (kind === "error") return { ...m, runStatus: "failed" }
            // kind === "cancelled"
            return { ...m, runStatus: "cancelled", stopped: true }
          }),
        )
```

From frontend/src/hooks/useMessages.ts:791-803 (CURRENT reconcile onTerminal override — same shape; ADD 5th branch):
```typescript
      callbacks.onTerminal = (kind, errorPayload) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== targetId) return m
            if (kind === "done") return { ...m, runStatus: "completed" }
            if (kind === "error") return { ...m, runStatus: "failed" }
            // kind === "cancelled"
            return { ...m, runStatus: "cancelled" }
          }),
        )
```

From frontend/src/components/chat/MessageItem.tsx:97-112 (CURRENT Resume button — only on failed; extend to timed_out):
```tsx
{/* Phase 063 (Pattern 4 / D-063-04): Resume button on failed runs. ... */}
{!isStreaming && message.role === "assistant" && message.runStatus === "failed" && (
  <Button variant="ghost" size="sm" onClick={() => onResume?.(message)} className="mt-2 text-xs" aria-label="Resume failed run">
    <RotateCcw className="w-3 h-3 mr-1.5" />
    Resume
  </Button>
)}
```

From frontend/src/components/chat/MessageItem.tsx:130-145 (CURRENT banner — keys on `message.stopped`; switch to runStatus-keyed):
```tsx
<span className="italic">
  {isStreaming
    ? (allToolsDone ? "Synthesizing answer" : "Working")
    : message.stopped
      ? "Response stopped"
      : "Saving response…"}
</span>
```
</interfaces>

<key_decisions>
**Locked decisions from CONTEXT.md (NON-NEGOTIABLE):**
- D-066-09: Resume button gating extends from `runStatus === 'failed'` to `runStatus === 'failed' || runStatus === 'timed_out'`. Click handler unchanged (same `onResume?.(message)` callback).
- D-066-10: Banner copy switch on `runStatus`:
  - `cancelled` → "Response stopped" (today's text — UNCHANGED)
  - `timed_out` → "Agent reached time limit" (NEW)
  - `failed` → existing failed-state behavior (today: NO banner here — failed renders the Resume button instead. Verified by reading MessageItem.tsx: `message.stopped && !isStreaming` only fires for cancelled/timed_out paths, NOT for failed)
  - `completed` → no banner (today)
  - Falls back to `message.stopped` for legacy rows predating runStatus join (D-063.1-15)
- D-066-06: SSE wire format adds `{type:"timed_out"}` sentinel — Plan 03's `subscribeToRun` parser MUST dispatch this to `onTerminal("timed_out")`.

**Banner copy choice (Claude's discretion per CONTEXT.md):** "Agent reached time limit" — concise, user-friendly, not jargony, fits the Aether Intelligence design system voice (matches "Response stopped" pattern). Verified against existing UI text via `grep` — no conflicting precedent. The user can rename in a follow-up if needed.

**The two `onTerminal` callsites must stay in sync.** useMessages.ts has TWO override sites: line ~567 (sendMessage) and line ~795 (reconcile). Both need the new branch. The Plan 01 sendMessage path sets `stopped: true` on cancelled; for timed_out, ALSO set `stopped: true` so the banner-rendering condition (`message.stopped && !isStreaming`) at MessageItem.tsx:147 fires for timed_out. The reconcile path does NOT set `stopped: true` on cancelled today (different invariants — reconcile re-attaches mid-stream); follow the existing convention there too: timed_out gets `runStatus: "timed_out"` only, not `stopped: true`. The MessageItem switch keys on `runStatus` first (when present), so the banner renders correctly via runStatus regardless of `stopped`.
</key_decisions>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Backend SSE wire ↔ frontend parser | New `{type:"timed_out"}` event shape — both sides must agree. Plan 01 owns backend; Plan 03 owns frontend. |
| Backend Pydantic JSON ↔ frontend mapper | `run_status: "timed_out"` from `GET /threads/{id}/messages` must round-trip. Plan 01 extended Pydantic; Plan 03 extends the type assertion. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-066-09 | Tampering / regression | New `timed_out` SSE event misclassified by frontend parser as unknown → silent drop, banner never renders | mitigate | Explicit `else if (t === "timed_out")` branch in `subscribeToRun` parser (Subtask 2). TypeScript ensures all callers handle the 4th union member. Plan 05 live UAT confirms the banner renders. |
| T-066-10 | Information Disclosure | `runs.error` string passed through `onTerminal(kind, error)` to UI, displayed verbatim, leaks ExceptionClass / model_id | mitigate | Plan 03 does NOT render `error` payload to UI for `timed_out` — banner copy is the static string "Agent reached time limit". The error detail stays in `runs.error` (server-side, RLS-scoped) for debugging via SQL/observability. |
| T-066-11 | Tampering | Existing failed-state UX regresses because banner switch interferes | mitigate | The existing failed path renders no banner (Resume button instead) — the switch only adds a 4th branch BEFORE the existing fallback. Run `grep -n "Response stopped"` post-edit to verify the original cancelled string is preserved. |
</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Extend Message.runStatus type union + Pydantic mirror in api.ts getMessages mapper + StreamCallbacks.onTerminal kind union</name>
  <files>frontend/src/types/index.ts, frontend/src/lib/api.ts</files>
  <read_first>
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md (D-066-04, 06)
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-01-SUMMARY.md (Plan 01 backend Pydantic Literal — confirms 5-value alignment is required)
    - C:/Vibe Apps/Agentic RAG/frontend/src/types/index.ts lines 90-105 (Message type — runStatus declaration)
    - C:/Vibe Apps/Agentic RAG/frontend/src/lib/api.ts lines 56-101 (getMessages mapper — Pydantic mirror)
    - C:/Vibe Apps/Agentic RAG/frontend/src/lib/api.ts lines 161-209 (StreamCallbacks interface — onTerminal kind union)
  </read_first>
  <action>
**Subtask 1a — `frontend/src/types/index.ts:98`:** Replace the `runStatus` union to add `"timed_out"`:

Current:
```typescript
  /** Phase 063 (D-063-04): lifecycle status of the underlying run. Mirrors public.runs.status enum values. Resume button surfaces ONLY when runStatus === 'failed' (per D-063-04 / D-v2.5-05 — no auto-retry for paid LLM calls). */
  runStatus?: "streaming" | "completed" | "failed" | "cancelled"
```

Replace with:
```typescript
  /** Phase 063 (D-063-04) + Phase 066 (D-066-04, 09): lifecycle status of the underlying run. Mirrors public.runs.status enum values post-migration 038 (5 values). Resume button surfaces when runStatus === 'failed' || runStatus === 'timed_out' (D-066-09 — no auto-retry for paid LLM calls per D-v2.5-05). The 'timed_out' value (NEW in 066) renders an "Agent reached time limit" banner; 'cancelled' renders "Response stopped"; 'failed' renders the Resume button without a banner. */
  runStatus?: "streaming" | "completed" | "failed" | "cancelled" | "timed_out"
```

**Subtask 1b — `frontend/src/lib/api.ts:73`:** Replace the type-assertion `run_status` literal in the getMessages mapper:

Current:
```typescript
    run_status?: "streaming" | "completed" | "failed" | "cancelled" | null
```

Replace with:
```typescript
    run_status?: "streaming" | "completed" | "failed" | "cancelled" | "timed_out" | null  // Phase 066 D-066-04: mirrors backend MessageResponse.run_status 5-value Literal post-migration 038
```

**Subtask 1c — `frontend/src/lib/api.ts:168`:** Extend `StreamCallbacks.onTerminal` kind union from 3 to 4 values:

Current:
```typescript
/** Phase 063: callback shape for subscribeToRun. Mirrors the legacy POST-stream
 * callback signature (preserved for MessageItem rendering compat) plus the new
 * `onTerminal` callback that handles Phase 062 TERMINAL_TYPES (done | error | cancelled).
 */
export interface StreamCallbacks {
  onDelta: (text: string) => void
  onDone: () => void
  onTerminal: (kind: "done" | "error" | "cancelled", error?: string) => void
```

Replace with:
```typescript
/** Phase 063 / Phase 066: callback shape for subscribeToRun. Mirrors the legacy POST-stream
 * callback signature (preserved for MessageItem rendering compat) plus the
 * `onTerminal` callback that handles Phase 062 TERMINAL_TYPES extended by D-066-06
 * to 4 values (done | error | cancelled | timed_out).
 */
export interface StreamCallbacks {
  onDelta: (text: string) => void
  onDone: () => void
  // Phase 066 D-066-06: 4th kind 'timed_out' — distinct from 'error' (LLM/system failure)
  // and 'cancelled' (user-Stop). Hooks set runStatus='timed_out' on this; MessageItem
  // renders the "Agent reached time limit" banner + Resume button per D-066-09/10.
  onTerminal: (kind: "done" | "error" | "cancelled" | "timed_out", error?: string) => void
```

**Subtask 1d — `frontend/src/lib/api.ts:362-378` (subscribeToRun parser):** Add a new branch for `t === "timed_out"` BEFORE the cancelled branch (matches backend SSE wire format from Plan 01 D-066-06):

Find this block (the existing terminal-event dispatch ladder):

```typescript
        } else if (t === "stream_end") {
          callbacks.onTerminal("done")
          return
        } else if (t === "error") {
          callbacks.onTerminal("error", parsed.error as string | undefined)
          return
        } else if (t === "cancelled") {
          callbacks.onTerminal("cancelled")
          return
        }
```

Replace with:

```typescript
        } else if (t === "stream_end") {
          callbacks.onTerminal("done")
          return
        } else if (t === "error") {
          callbacks.onTerminal("error", parsed.error as string | undefined)
          return
        } else if (t === "timed_out") {
          // Phase 066 D-066-06: distinct system-timeout terminal sentinel —
          // wire-format value matches backend `_RUN_STATUS_TO_TERMINAL_TYPE`
          // map at threads.py:90-94 (Plan 01). The `error` payload is the
          // backend-formatted string (D-066-07: "timed_out: Ns per-call ...");
          // not displayed to the user (banner uses static "Agent reached time
          // limit" copy per D-066-10 / T-066-10) but passed through to the
          // hook layer for debugging if needed.
          callbacks.onTerminal("timed_out", parsed.error as string | undefined)
          return
        } else if (t === "cancelled") {
          callbacks.onTerminal("cancelled")
          return
        }
```
  </action>
  <verify>
    <automated>grep -q '"streaming" | "completed" | "failed" | "cancelled" | "timed_out"' "C:/Vibe Apps/Agentic RAG/frontend/src/types/index.ts"</automated>
    <automated>grep -q '"streaming" | "completed" | "failed" | "cancelled" | "timed_out" | null' "C:/Vibe Apps/Agentic RAG/frontend/src/lib/api.ts"</automated>
    <automated>grep -q 'kind: "done" | "error" | "cancelled" | "timed_out"' "C:/Vibe Apps/Agentic RAG/frontend/src/lib/api.ts"</automated>
    <automated>grep -q 't === "timed_out"' "C:/Vibe Apps/Agentic RAG/frontend/src/lib/api.ts"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/frontend" &amp;&amp; npx tsc --noEmit 2>&amp;1 | grep -E "error TS|error:" | wc -l | tr -d ' ' | grep -E "^0$"</automated>
  </verify>
  <done>
    - `frontend/src/types/index.ts:98` runStatus union has 5 string literals ending with `"timed_out"`
    - `frontend/src/lib/api.ts` getMessages mapper accepts `"timed_out"` as a `run_status` value
    - `StreamCallbacks.onTerminal` accepts a 4th kind `"timed_out"`
    - `subscribeToRun` parser has an explicit branch for `t === "timed_out"` BEFORE the `t === "cancelled"` branch
    - TypeScript compilation reports zero errors (verified via `tsc --noEmit`)
  </done>
</task>

<task type="auto">
  <name>Task 2: Add 5th onTerminal branches in useMessages.ts (BOTH sendMessage and reconcile callsites) + extend Resume gating + banner copy switch in MessageItem.tsx</name>
  <files>frontend/src/hooks/useMessages.ts, frontend/src/components/chat/MessageItem.tsx</files>
  <read_first>
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md (D-066-09, 10)
    - C:/Vibe Apps/Agentic RAG/frontend/src/hooks/useMessages.ts lines 555-585 (sendMessage onTerminal override)
    - C:/Vibe Apps/Agentic RAG/frontend/src/hooks/useMessages.ts lines 785-815 (reconcile onTerminal override)
    - C:/Vibe Apps/Agentic RAG/frontend/src/components/chat/MessageItem.tsx lines 95-150 (Resume button + banner copy site)
  </read_first>
  <action>
**Subtask 2a — `frontend/src/hooks/useMessages.ts` sendMessage onTerminal (line ~561-572):** Add the 5th branch BEFORE the cancelled fallback. Replace the existing block:

```typescript
      callbacks.onTerminal = (kind, errorPayload) => {
        // Map TERMINAL_TYPES → runStatus enum value (literal-per-branch so future
        // greps for `runStatus: "<value>"` find every branch).
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            if (kind === "done") return { ...m, runStatus: "completed" }
            if (kind === "error") return { ...m, runStatus: "failed" }
            // kind === "cancelled"
            return { ...m, runStatus: "cancelled", stopped: true }
          }),
        )
```

with:

```typescript
      callbacks.onTerminal = (kind, errorPayload) => {
        // Map TERMINAL_TYPES → runStatus enum value (literal-per-branch so future
        // greps for `runStatus: "<value>"` find every branch).
        // Phase 066 D-066-06: 5th kind 'timed_out' added BEFORE the cancelled
        // fallback. Sets stopped: true so MessageItem.tsx:147 banner renders
        // (matches the cancelled branch — both timed_out and cancelled are
        // user-visible "this stopped before completing" terminal states).
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

**Subtask 2b — `frontend/src/hooks/useMessages.ts` reconcile onTerminal (line ~791-803):** Mirror the addition, but DO NOT set `stopped: true` (matches the existing reconcile-path convention — see `<key_decisions>` rationale). Replace:

```typescript
      callbacks.onTerminal = (kind, errorPayload) => {
        // Terminal status flip is unconditional (the run actually ended;
        // the placeholder needs the correct runStatus when the user
        // navigates back).
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== targetId) return m
            if (kind === "done") return { ...m, runStatus: "completed" }
            if (kind === "error") return { ...m, runStatus: "failed" }
            // kind === "cancelled"
            return { ...m, runStatus: "cancelled" }
          }),
        )
```

with:

```typescript
      callbacks.onTerminal = (kind, errorPayload) => {
        // Terminal status flip is unconditional (the run actually ended;
        // the placeholder needs the correct runStatus when the user
        // navigates back).
        // Phase 066 D-066-06: 5th kind 'timed_out' added BEFORE the cancelled
        // fallback. Reconcile path does NOT set stopped: true here (unlike
        // sendMessage) — reconcile re-attaches to a possibly-not-yet-stopped
        // run, and stopped: true would mis-render mid-stream. MessageItem
        // banner switch keys on runStatus first, falling back to stopped only
        // for legacy rows pre-D-063.1-15 — so runStatus="timed_out" alone is
        // sufficient to render the "Agent reached time limit" banner.
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

**Subtask 2c — `frontend/src/components/chat/MessageItem.tsx:101` Resume button gating:** Replace:

```tsx
{!isStreaming && message.role === "assistant" && message.runStatus === "failed" && (
```

with:

```tsx
{/* Phase 066 D-066-09: gating extends to runStatus === 'timed_out' (per-call
    deadline fired). Same onResume callback re-POSTs the original prompt with
    full conversation context (today's failed-state Resume code path). */}
{!isStreaming && message.role === "assistant" && (message.runStatus === "failed" || message.runStatus === "timed_out") && (
```

**LOCKED — update aria-label to `"Resume run"`** (accuracy with new gating). Find the existing line:

```tsx
aria-label="Resume failed run"
```

Replace with:

```tsx
aria-label="Resume run"
```

Rationale: with Resume now gating on `(failed || timed_out)`, the existing `"Resume failed run"` label is inaccurate (it would announce "Resume failed run" via screen reader for a `timed_out` message, misrepresenting the message state). The shorter `"Resume run"` label is both accurate and concise — matches the visible button text "Resume". This is a one-character-string-replacement with no functional risk.

**Subtask 2d — `frontend/src/components/chat/MessageItem.tsx:130-145` banner copy switch:** Replace:

```tsx
            <span className="italic">
              {isStreaming
                ? (allToolsDone ? "Synthesizing answer" : "Working")
                : message.stopped
                  ? "Response stopped"
                  : "Saving response…"}
            </span>
```

with:

```tsx
            <span className="italic">
              {isStreaming
                ? (allToolsDone ? "Synthesizing answer" : "Working")
                : message.runStatus === "timed_out"
                  ? "Agent reached time limit"   /* Phase 066 D-066-10 — system per-LLM-call deadline fired */
                  : message.runStatus === "cancelled" || message.stopped
                    ? "Response stopped"          /* user clicked Stop (D-066-10); stopped fallback for legacy pre-runStatus rows */
                    : "Saving response…"}
            </span>
```

The condition order matters: `timed_out` must check BEFORE `cancelled` (otherwise the legacy `message.stopped` fallback for cancelled would also catch timed_out runs since Plan 03 sets `stopped: true` on timed_out in the sendMessage path). Switching on `runStatus` first scopes correctly.
  </action>
  <verify>
    <automated>grep -q 'kind === "timed_out"' "C:/Vibe Apps/Agentic RAG/frontend/src/hooks/useMessages.ts"</automated>
    <automated>grep -c 'kind === "timed_out"' "C:/Vibe Apps/Agentic RAG/frontend/src/hooks/useMessages.ts" | grep -E "^2$"</automated>
    <automated>grep -q 'runStatus: "timed_out", stopped: true' "C:/Vibe Apps/Agentic RAG/frontend/src/hooks/useMessages.ts"</automated>
    <automated>grep -q 'message.runStatus === "failed" || message.runStatus === "timed_out"' "C:/Vibe Apps/Agentic RAG/frontend/src/components/chat/MessageItem.tsx"</automated>
    <automated>grep -q 'aria-label="Resume run"' "C:/Vibe Apps/Agentic RAG/frontend/src/components/chat/MessageItem.tsx"</automated>
    <automated>! grep -q 'aria-label="Resume failed run"' "C:/Vibe Apps/Agentic RAG/frontend/src/components/chat/MessageItem.tsx"</automated>
    <automated>grep -q 'Agent reached time limit' "C:/Vibe Apps/Agentic RAG/frontend/src/components/chat/MessageItem.tsx"</automated>
    <automated>grep -q 'message.runStatus === "timed_out"' "C:/Vibe Apps/Agentic RAG/frontend/src/components/chat/MessageItem.tsx"</automated>
    <automated>grep -q 'Response stopped' "C:/Vibe Apps/Agentic RAG/frontend/src/components/chat/MessageItem.tsx"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/frontend" &amp;&amp; npx tsc --noEmit 2>&amp;1 | grep -E "error TS|error:" | wc -l | tr -d ' ' | grep -E "^0$"</automated>
  </verify>
  <done>
    - useMessages.ts has TWO `kind === "timed_out"` branches (sendMessage + reconcile callsites) — verified by `grep -c` returning 2
    - sendMessage path sets `stopped: true` on timed_out; reconcile path does NOT
    - MessageItem.tsx Resume gating uses `(message.runStatus === "failed" || message.runStatus === "timed_out")`
    - MessageItem.tsx Resume button aria-label updated to `"Resume run"` (was `"Resume failed run"` — inaccurate with the expanded gating)
    - MessageItem.tsx banner switch keys on `runStatus === "timed_out"` BEFORE `runStatus === "cancelled" || message.stopped`
    - "Response stopped" string preserved (cancelled path)
    - "Agent reached time limit" string introduced (timed_out path)
    - TypeScript compilation reports zero errors
  </done>
</task>

<task type="auto">
  <name>Task 3: Commit frontend lifecycle UI for timed_out</name>
  <files>frontend/src/types/index.ts, frontend/src/lib/api.ts, frontend/src/hooks/useMessages.ts, frontend/src/components/chat/MessageItem.tsx</files>
  <read_first>
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-01-SUMMARY.md
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-02-SUMMARY.md (if Plan 02 has shipped — Plan 03 is parallel-safe, may merge later)
  </read_first>
  <action>
Stage exactly the 4 files (no `git add -A`):

```bash
git add frontend/src/types/index.ts frontend/src/lib/api.ts frontend/src/hooks/useMessages.ts frontend/src/components/chat/MessageItem.tsx
```

Commit (HEREDOC):

```
feat(066-03): frontend lifecycle UI for 'timed_out' — Resume gating + "Agent reached time limit" banner

Phase 066 D-066-04, 06, 09, 10. Mirrors Plan 01's backend lifecycle split
on the frontend so the new `timed_out` terminal state surfaces with
distinct UI rather than falling into the cancelled fallback.

- frontend/src/types/index.ts:98 — Message.runStatus union extends to 5
  values (D-066-04).
- frontend/src/lib/api.ts:73 — getMessages mapper Pydantic mirror extends
  to 5 values (matches backend MessageResponse Literal in Plan 01).
- frontend/src/lib/api.ts:168 — StreamCallbacks.onTerminal kind union
  extends to 4 values: done | error | cancelled | timed_out (D-066-06).
- frontend/src/lib/api.ts:~378 — subscribeToRun parser dispatches
  `t === "timed_out"` events to onTerminal("timed_out", error) BEFORE
  the cancelled branch — matches backend SSE wire format from Plan 01.
- frontend/src/hooks/useMessages.ts:~570 (sendMessage path) — 5th
  onTerminal branch sets runStatus='timed_out', stopped=true so the
  banner renders.
- frontend/src/hooks/useMessages.ts:~798 (reconcile path) — 5th
  onTerminal branch sets runStatus='timed_out' only (no stopped) per
  reconcile-path convention.
- frontend/src/components/chat/MessageItem.tsx:101 — Resume button
  gating extends to (failed || timed_out) per D-066-09. onResume
  callback unchanged — re-POSTs original prompt.
- frontend/src/components/chat/MessageItem.tsx:130-145 — banner copy
  switches on runStatus: timed_out → "Agent reached time limit";
  cancelled || message.stopped → "Response stopped". Order matters
  (timed_out checked first to avoid falling through stopped fallback
  for sendMessage path which sets both). Per D-066-10.

Vitest deferred per Phase 063.1 plan precedent (npm optional-dep
cascade — vitest unavailable on this dev machine). Gate is `tsc --noEmit`
green; runtime behavior verification in Plan 05 live UAT.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; git log -1 --pretty=%s | grep -q "066-03"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; git log -1 --name-only --pretty=format: | tr -d '\r' &gt; /tmp/066-03-files.txt &amp;&amp; grep -q "frontend/src/types/index.ts" /tmp/066-03-files.txt &amp;&amp; grep -q "frontend/src/lib/api.ts" /tmp/066-03-files.txt &amp;&amp; grep -q "frontend/src/hooks/useMessages.ts" /tmp/066-03-files.txt &amp;&amp; grep -q "frontend/src/components/chat/MessageItem.tsx" /tmp/066-03-files.txt</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/frontend" &amp;&amp; npx tsc --noEmit 2>&amp;1 | grep -E "error TS|error:" | wc -l | tr -d ' ' | grep -E "^0$"</automated>
  </verify>
  <done>
    - Single commit named "feat(066-03): ..." on the current branch
    - Touches exactly the 4 frontend files (none of the backend ones)
    - TypeScript compile remains green
  </done>
</task>

</tasks>

<verification>
- All grep gates from Tasks 1-3 pass
- `cd frontend && npx tsc --noEmit` reports zero errors
- One commit landed (no working-tree drift)
- No vitest run required (deferred — banner behavior verified in Plan 05 live UAT)
</verification>

<success_criteria>
- 5-value Message.runStatus union (D-066-04)
- 4-value onTerminal kind union; subscribeToRun parser dispatches `t === "timed_out"` (D-066-06)
- useMessages.ts onTerminal overrides have 5 branches each — sendMessage AND reconcile (matches backend wire format)
- Resume button gates on `runStatus === "failed" || runStatus === "timed_out"` (D-066-09)
- Banner shows "Agent reached time limit" for timed_out, "Response stopped" for cancelled (D-066-10)
- Single commit
- tsc compile green
</success_criteria>

<output>
After completion, create `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-03-SUMMARY.md` documenting:
- Confirmation of `tsc --noEmit` exit-0 output
- Confirmation aria-label was updated to `"Resume run"` (LOCKED per plan revision — was discretionary in pre-revision draft)
- Banner-copy choice ("Agent reached time limit" — chosen per Aether voice; alternatives considered)
- Plan 05 UAT prerequisite: with `ENABLE_TEST_FIXTURES=1`, force a synthetic timeout and verify the banner + Resume button render
</output>
