# Phase 067: Frontend Streaming-UX Fix — Research

**Researched:** 2026-05-07
**Domain:** React state-machine surgery (useMessages.ts) + backend Redis-consumer cancellation hygiene + tool-call iteration-boundary visual
**Confidence:** HIGH (every claim verified by direct code read at the cited file:line)

## Summary

Phase 067 closes a five-issue dossier (UX-067-01..05) carried forward from Phase 066's live UAT plus a deferred SC#6 closure. The architectural substrate (Redis Streams run-backed streaming, 5-value `runs.status` enum, per-LLM-call timeout, clean SDK stream closure) shipped successfully in 061→063.1→066; the gap is the display layer.

Three independent diff surfaces, ordered by risk:

1. **`useMessages.ts` state-machine cleanup** — the highest-risk surface because the file already carries five layers of race-condition fixes (D-060-01/02, D-063-01..04, D-063.1-04..15, D-066-04..06). Phase 067 D-067-01/02 must extend the existing guards without breaking them. The surgical hot-spots are:
   - sendMessage's `originalOnTerminal` override at lines 560-589 — uses `setMessages` (line 568), NOT `guardedSetMessages` (declared lines 544-549). UNGUARDED CONFIRMED.
   - reconcile's `originalOnTerminal` override at lines 795-826 — uses `setMessages` (line 807), NOT `guardedSetMessages` (declared lines 779-784). UNGUARDED CONFIRMED.
   - `MessageItem.tsx:140` — the literal string `"Saving response…"` is the fallback inside the `hasAnyTools && !isStreaming` branch when `runStatus` is undefined and `stopped` is false; D-067-02 deletes this entire fallback by tightening the `runStatus`-keyed switch at lines 134-145.

2. **`runs.py` cancellation logging hygiene** — the existing `try/except RedisError` at runs.py:168-174 ALREADY catches the `redis.exceptions.TimeoutError` (it is a subclass of `RedisError`) and converts it to a clean `error: redis_error` SSE event. The visible stack trace comes from the `logger.exception(...)` call at line 169 which dumps a full traceback every time. The fix is to differentiate `redis.exceptions.TimeoutError` (cancellation-equivalent — log INFO, no traceback) from other RedisErrors (genuine Redis failures — keep `logger.exception`). This is a 5-10 line surgical edit, NOT an architectural change.

3. **`ToolCallPanel.tsx` Step N divider** — the iterationCount field is wired in (api.ts:394 emits, useMessages.ts:274 sets, types/index.ts:82 declares, ToolCallPanel.tsx:529-543 reads it for the HEADER label "Step N — Searching for X"). The miss is structural: ToolCall has no `iteration` field (types/index.ts:28-43), so the panel cannot partition the flat `tool_calls` array into per-iteration groups for divider rendering. D-067-03 needs a small data-model addition (one `iteration?: number` field on ToolCall, stamped at `onToolStart`/`onToolPreparing` from a tracked counter inside the assistant message).

**Primary recommendation:** plan four surgical commits in the order specified by CONTEXT.md `<code_context>` (state-machine → divider → cancellation → stopgap removal), then run the live-UAT closing protocol (D-067-05). vitest is FUNCTIONAL on this machine as of this research session — the Phase 063.1/066 vitest-unavailable constraint is RESOLVED and unit tests can run for the first time since 063.1. Live verification via Chrome MCP / Supabase MCP / LangSmith MCP remains REQUIRED per D-067-07 regardless of vitest availability.

## Project Constraints (from CLAUDE.md)

These are project-level laws that bind every Phase 067 task. The planner MUST verify compliance:

- Python backend uses a `venv` virtual environment (`backend/venv/`)
- No LangChain, no LangGraph — raw SDK calls only (Anthropic native, OpenAI, Google)
- Pydantic for structured LLM outputs
- All tables have RLS — users only see their own data
- SSE streaming for chat
- Stateless chat completions — store and send chat history yourself
- Single uvicorn worker (D-v2.5-02) — `--workers N` masks concurrency bugs
- Use `run_in_threadpool` for blocking I/O in async handlers (D-v2.5-01)
- Supabase Realtime is best-effort hint, NOT source of truth — reconcile via fetch (D-v2.5-03)
- Schema changes ship as numbered SQL migrations — Phase 067 ships **NO migrations** (verified — no schema work)
- Apply migrations via Supabase SQL editor; never `supabase db push`/`db reset` — N/A this phase
- Settings live in `user_settings` / `app_settings`; env vars are for secrets and infra only — Phase 067 REMOVES one env var (`RUN_HARD_TIMEOUT_SECONDS`) per D-067-06

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-067-01 (First-paint posture, UX-067-01/03):** Architectural cleanup of streaming-attach lifecycle — NOT a surgical race patch. Pull SSE attach + optimistic placeholder insertion + reconcile-on-mount into one well-ordered, single-source-of-truth state machine in `useMessages.ts`. Attack the root pattern (overlapping side-effects between `sendMessage`, `reconcile`, and `ChatArea` triggers), not individual race symptoms. Keep the temp-`${run_id}` placeholder + Phase 063.1 D-063.1-12 MERGE-preserve-temp-placeholders pattern. Anti-patterns to avoid: no side-effects inside `setMessages` updaters; no concurrent `setMessages` writes from different code paths without an explicit guard; preserve Phase 063.1's `reconcileInFlightRef` boolean lock and `guardedSetMessages` thread-match gate verbatim — extend, don't replace.

**D-067-02 (Mid-stream UI state semantics, UX-067-02):** Match Claude/ChatGPT — NO extra status indicators while streaming. Delete the `"Saving response…"` fallback at `MessageItem.tsx:140`. Banner copy is reserved for terminal states only:
- `cancelled` → "Response stopped"
- `timed_out` → "Agent reached time limit" (Phase 066 D-066-10, unchanged)
- `failed` → existing failed-state copy
- `streaming` and `completed` → no banner, no fallback

The terminal-flip `setMessages` MUST be subject to the same guarded-by-thread-match invariant as the delta callbacks (today it isn't). No new "persisting" or "thinking" indicator is added.

**D-067-03 (Tool-call iteration boundary visual, UX-067-05):** Subtle "Step N" gradient divider between tool-call iterations in `ToolCallPanel.tsx`. The `onIterationStart` SSE callback already fires per iteration boundary (api.ts:394, useMessages.ts:274) and increments `Message.iterationCount`. The plumbing is in; the rendering is missing. Render a thin gradient divider with `Step {iteration_index}` text label. No collapsible iteration sections, no LLM-generated step summaries — those are deferred. The first iteration MAY render without an explicit "Step 1" divider above it (recommend yes; confirm during implementation).

**D-067-04 (Backend Redis-consumer cancellation cleanup, UX-067-04):** At the two `xread` call sites in `backend/app/api/runs.py:163` (live-tail block) and `:184` (post-BLOCK exists probe), wrap the await in an explicit `try / except (asyncio.CancelledError, redis.exceptions.TimeoutError)` and:
- Log at `INFO` (not `WARNING`/`ERROR`) with a clear message — no stack trace.
- For `CancelledError`: re-raise (cooperative cancellation, never swallow — preserves Phase 059 D-059-04).
- For `TimeoutError`: treat as cancellation-equivalent at this call site; close the SSE response cleanly. Do NOT propagate as a 503.
- Out of scope: changing redis-py's `async_timeout` wrapper, switching Redis client, modifying the live-tail BLOCK timeout.

**D-067-05 (SC#6 protocol re-run as closing UAT):** Inline SC#6 re-run as the closing UAT of Phase 067 — NOT a separate UAT pass. Once UX-067-01..05 land and Chrome MCP confirms they're live, immediately re-run Phase 066 Plan 05 Task 2 protocol verbatim:
1. Set `LLM_CALL_TIMEOUT_OVERRIDES=<active-model>=10` in `backend/.env`.
2. Restart backend.
3. Submit deliberately-slow prompt against the active model.
4. Observe in Chrome MCP: "Agent reached time limit" banner + Resume button + Resume-click re-POST.
5. Verify in LangSmith MCP: trace shows clean `TimeoutError` (no `GeneratorExit` at `run_helpers.py:1680`).
6. Verify in Supabase MCP/CLI: `runs.status='timed_out'`, `runs.error LIKE 'timed_out: %'`.
7. Update `066-HUMAN-UAT.md` SC#6 row from `deferred` → `green`.

Cleanup: revert `LLM_CALL_TIMEOUT_OVERRIDES` to empty string after the test.

**D-067-06 (Stopgap removal):** Delete `RUN_HARD_TIMEOUT_SECONDS=600` line from `backend/.env` and any matching cosmetic refs in `backend/.env.example`, `supabase/SETUP.md`, `REDIS-SETUP.md`. The wrapper consumer was deleted in Phase 066 D-066-01; Pydantic `extra="ignore"` silently drops the env var today.

**D-067-07 (Live-tooling verification rule, phase-wide):** End-to-end live verification is REQUIRED — not optional, not "nice to have." Every UX fix MUST be confirmed live before that fix's commit is treated as done:
- **Chrome MCP** for every visible UI change (placeholder render, real-time delta painting, "Step N" dividers, terminal banner correctness, Resume button visibility, no "Saving response…" thrash). Visual confirmation, not just `tsc --noEmit` green.
- **Supabase MCP / CLI** for every backend lifecycle assertion (runs-row inspection, terminal-state correctness, no orphaned `streaming` rows). Live DB authoritative.
- **LangSmith MCP** for every timeout/cancellation/error path (trace inspection for `GeneratorExit` absence, clean stream closure, expected exception column). Backend log greps are NOT a substitute.

### Claude's Discretion

- Exact divider styling tokens for "Step N" (color, gradient direction, font weight, padding). Pick from existing Aether Intelligence design tokens; if no clean match exists, propose 2-3 variants in plan-phase. Spawn `/gsd:ui-phase 067` only if the design surface ends up larger than expected.
- Whether the first iteration renders WITHOUT a "Step 1" divider above it. Recommend yes.
- Where to draw the boundary between the new "single state machine" (D-067-01) and the existing `useMessages.ts` shape — extract to a hook or keep inline. Prefer keep-inline unless the diff exceeds ~150 lines.
- Whether D-067-06 lands in its own commit or is folded into another plan's cleanup. Either is fine.
- Banner copy refinements — small wording tweaks for `failed`-state copy if `runs.error` strings need truncating.

### Deferred Ideas (OUT OF SCOPE)

- **Collapsible iteration sections** (`[▾] Step 1 — search & draft`) — heavier visual treatment with collapse/expand affordance. Re-open if Phase 067 UAT surfaces flat dividers don't help readability on long runs (6+ iterations).
- **LLM-generated step summaries** ("Step 2 — generating charts") — agent-side describes its own iteration intent. Larger surface (prompt change + new SSE field). Re-open if subtle "Step N" label proves too generic.
- **`/gsd:ui-phase 067`** — full UI design contract for the divider + banner + placeholder visual states. Re-open if D-067-03 implementation surfaces design ambiguity beyond Claude's discretion.
- **Iteration-boundary collapse-on-completion** — auto-collapse completed iterations. Re-open if long runs become unreadable scroll surfaces.
- **Backend SSE emission audit** — confirm every state transition in `agent_runner` emits an SSE event before the next state begins. Re-open if D-067-02's tightening surfaces a backend-emission gap.
- **Persistent-state indicator** ("Saving…" between SSE-end and Postgres persist) — D-067-02 chose match-Claude-and-don't-show-it. Re-open if users report confusion when the assistant message appears to vanish briefly.
- **Tool-call surfacing for Explorer mode** — D-067-03 applies to General mode by default; verify it works for Explorer too in plan-phase.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STREAM-04-polish | Continuation of v2.5 STREAM-04 — restore real-time first-paint of streaming agent events on the chat surface (no manual refresh required) and close the five carry-forward UX issues + Phase 066 SC#6 deferred closure. | Verified by direct read of useMessages.ts (3 setMessages call sites converging on placeholder), api.ts subscribeToRun parser (lines 265-433 — already wires onIterationStart, runStatus, terminal sentinels), runs.py replay_tail_consumer (lines 76-225 — already has try/except RedisError but logs full traceback), ToolCallPanel.tsx (lines 529-575 — header-label-only Step N rendering, no per-iteration partitioning). Backend Phase 066 architectural deliverable already proved end-to-end (run `95e3447c-cf9b-448b-9e0d-22c30e40670d`, 9m02s `completed`, `error=NULL`); the gap is exclusively display-layer. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| First-paint state machine | Browser (React useMessages.ts) | — | All in-flight assistant-message state lives in React. Backend has no responsibility for which DOM bubble is visible. |
| `runStatus` terminal-flip mutation | Browser (useMessages.ts:560-589, 795-826) | — | Backend EMITS terminal SSE sentinel; frontend's `onTerminal` callback is the sole writer of the post-stream `runStatus` field on the placeholder Message. |
| `temp-${run_id}` placeholder rendering | Browser (useMessages.ts insertions + MessageItem.tsx render) | — | Backend has no concept of "placeholder" — only persisted runs rows + Redis Stream events. |
| "Saving response…" / "Agent reached time limit" / "Response stopped" copy | Browser (MessageItem.tsx:130-166) | — | All UI strings; selected by frontend based on `runStatus` value. |
| "Step N" iteration boundary visual | Browser (ToolCallPanel.tsx) | — | Backend already emits `iteration_start` events (threads.py:1133); frontend renders. Pure display layer. |
| Redis consumer cancellation logging | API/Backend (runs.py:76-225 `replay_tail_consumer`) | — | The xread BLOCK + post-BLOCK exists probe live in the consumer generator; cancellation behavior is owned by the SSE response generator that owns the open socket. |
| Stopgap env-var cleanup | API/Backend (`backend/.env`, `backend/.env.example`) + Docs | — | One-line config-file edit. |
| Live UAT verification via MCP | Browser (Chrome MCP) + API (Supabase MCP) + Observability (LangSmith MCP) | — | Multi-tool because the verification surface spans: visible UI behavior (Chrome) + persisted runs row (Supabase) + clean trace closure (LangSmith). |

## Standard Stack

### Core (already in place — Phase 067 does NOT add)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x (verified by Vite + frontend/package.json import patterns) `[VERIFIED: code read]` | UI framework | Project standard since v1.0 |
| `redis-py` (asyncio) | 5.3.1 | Redis Stream consumer (`xread`, `xadd`, `exists`, `expire`, `zrem`, `set`) `[VERIFIED: backend/venv/Lib/site-packages/redis-5.3.1.dist-info]` | Project standard since Phase 061 D-v2.5-08 |
| FastAPI / Starlette / `sse-starlette` | from requirements.txt `[VERIFIED: backend/requirements.txt:5-7]` | SSE response handler (`EventSourceResponse`) | Phase 061+ canonical pattern |
| `lucide-react` icons (RotateCcw, Square, Loader2, etc.) | from package.json | UI iconography | Project standard since v2.3 Aether redesign |

### Supporting (Phase 067 USES — does NOT add)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | 4.1.0 (FUNCTIONAL on this machine as of 2026-05-07 research session) `[VERIFIED: npx vitest --version]` | Frontend unit tests | NOW AVAILABLE — was the blocker for Phase 063.1/066 plan-level test discipline; Phase 067 CAN add unit tests for state-machine cleanup. |
| `@rolldown/binding-win32-x64-msvc` | (from optionalDependencies cascade) `[VERIFIED: ls frontend/node_modules/@rolldown/binding-win32-x64-msvc/]` | Vite/vitest native binding | Resolved since Phase 063.1 — npm install reproducibility on Windows now intact. |
| Tailwind utility classes (`gradient-primary`, `bg-gradient-to-r from-primary/30 to-primary/10`, `bg-border/20`, `h-px`) | Tailwind v3.x (Aether Intelligence theme) `[VERIFIED: ToolCallPanel.tsx:705 uses `from-primary/30 to-primary/10`; line 473 uses `from-primary to-violet-500`; lines 640/656 use `h-px bg-border/20`]` | Step N divider styling | Phase 067 D-067-03 should reuse existing visible patterns: `h-px bg-border/20` is the existing inter-tool separator (lines 640, 656). The "subtle gradient" mockup `──── Step 2 ──────` matches the existing `from-primary to-violet-500` palette already used at line 473. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Adding `iteration?: number` field on `ToolCall` | Track separate `iterationBoundaries: number[]` on `Message` | The boundary array is more compact but requires additional state-update logic on every `onToolStart`. Per-tool-call iteration field is simpler — stamp once when the tool is created. Recommend per-tool-call field. |
| `try/except (CancelledError, redis.exceptions.TimeoutError)` at runs.py:163, 184 | A broader `try/except BaseException` with type-discrimination inside | The narrow except catches only the two known cases; broader catches risk swallowing genuine bugs. Stick with the narrow pattern. |
| Deleting `"Saving response…"` fallback string entirely | Replacing it with empty string `""` so the `<span>` still renders | Empty string still renders the `flex items-center` parent with the bouncing dots. Empty fallback would leave a meaningless dots animation. Better to remove the entire `: "Saving response…"` branch and render `null` when no terminal state matches. |
| Refactor useMessages.ts into a separate hook (extract single state machine) | Keep inline + extend `guardedSetMessages` to wrap terminal-flip | Extraction is risk-multiplying — D-067-01 explicitly says "Prefer keep-inline unless the diff exceeds ~150 lines." The terminal-flip wrap is ~10 lines per call site; well within keep-inline scope. |

**Installation:** No new packages this phase. Verify existing:

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json   # always-on gate
cd frontend && npx vitest --version                 # was a Phase 063.1/066 blocker — now resolved
cd backend && venv/Scripts/python.exe -c "import redis; print(redis.__version__)"  # 5.3.1
```

## Architecture Patterns

### System Architecture Diagram

```
                       Browser (single uvicorn worker, single React app)
                       ┌───────────────────────────────────────────────────────────────────┐
   user types prompt ──┤  ChatArea.tsx                                                       │
                       │   ├── visibilitychange/focus/pageshow → reconcile(threadId)         │
                       │   └── handleSend → sendMessage(threadId, content, model, …)         │
                       │                                                                     │
                       │  useMessages.ts (single state mutator)                              │
                       │   ├── messages: Message[]                                           │
                       │   ├── activeThreadIdRef    ┐                                        │
                       │   ├── streamingThreadIdRef ┤── guardedSetMessages gates writes     │
                       │   ├── reconcileInFlightRef ┘                                        │
                       │   ├── lastSeenOffsetRef Map<run_id, ms_id>                          │
                       │   ├── subscriptionsRef Map<run_id, AbortController>                 │
                       │   │                                                                  │
                       │   ├── sendMessage:                                                  │
                       │   │     POST /threads/{tid}/messages → {message_id, run_id}          │
                       │   │     stamp run_id on placeholder                                  │
                       │   │     subscribeToRun(run_id, since="0", callbacks, signal)         │
                       │   │     callbacks.onTerminal flips runStatus    ◄── D-067-02 makes  │
                       │   │                                              guard-aware         │
                       │   │                                                                  │
                       │   ├── reconcile:                                                    │
                       │   │     [GET active-runs, loadMessages] (Promise.all)               │
                       │   │     for each active run:                                        │
                       │   │       runId-match dedup ── uses persisted DB row OR temp-       │
                       │   │       insert placeholder if no match                            │
                       │   │       narrow short-circuit on subscriptionsRef.has              │
                       │   │       subscribeToRun(run_id, lastSeenOffsetRef, …)              │
                       │   │       callbacks.onTerminal flips runStatus  ◄── D-067-02 same  │
                       │   │                                                                  │
                       │   └── loadMessages: GET /threads/{tid}/messages → MERGE-preserving  │
                       │                       temp- placeholders                             │
                       └───────────────────────────────────────────────────────────────────┘
                                                  │ HTTPS / SSE
                                                  ▼
                       Backend FastAPI (single uvicorn worker per D-v2.5-02)
                       ┌───────────────────────────────────────────────────────────────────┐
                       │  POST /threads/{tid}/messages  (threads.py)                         │
                       │   ├── insert messages row (user)                                   │
                       │   ├── insert runs row (status='streaming')                         │
                       │   ├── RUN_TASKS[run_id] = asyncio.create_task(agent_runner(...))   │
                       │   └── return {message_id, run_id}                                  │
                       │                                                                     │
                       │  agent_runner(producer):                                           │
                       │   for iteration in range(max_iterations):                          │
                       │     await _emit(redis, run_id, 'iteration_start', iteration=N)  ◄──┤── D-067-03 source
                       │     LLM stream block (per-call asyncio.timeout(per_call_budget))   │
                       │     tools dispatched + emitted                                     │
                       │   _shielded_finalize:                                              │
                       │     terminal classification → status, error                        │
                       │     _emit_terminal(redis, run_id, type)                            │
                       │     UPDATE runs row                                                │
                       │     EXPIRE run:{run_id}                                            │
                       │     RUN_TASKS.pop(run_id)                                          │
                       │                                                                     │
                       │  GET /runs/{rid}/stream?since={offset}  (runs.py)                  │
                       │   ├── ownership SELECT runs row (404 not 403 — IDOR mitigation)    │
                       │   ├── Redis health probe (503 + Retry-After: 10 if down)           │
                       │   ├── if buffer_exists: replay_tail_consumer(redis, rid, since)    │
                       │   │     Phase 1: replay backlog from since                         │
                       │   │     Phase 2: live-tail (BLOCK 5000)                            │
                       │   │       try: redis.xread(...)                                    │
                       │   │       except RedisError: log+yield error+return  ◄── D-067-04 │
                       │   │       break on TERMINAL_TYPES sentinel                         │
                       │   └── else: synthetic terminal generator (TTL-expired path)        │
                       └───────────────────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                       ┌──────────────────────────────────────────┐
                       │  Redis Streams (run:{run_id})             │
                       │  + Postgres public.runs                   │
                       └──────────────────────────────────────────┘
```

### Recommended Project Structure

```
frontend/src/
├── hooks/useMessages.ts            # PRIMARY DIFF (D-067-01, D-067-02)
├── components/chat/
│   ├── ChatArea.tsx                # READ ONLY — confirm no new triggers needed
│   ├── MessageItem.tsx             # DELETE "Saving response…" fallback (D-067-02)
│   └── ToolCallPanel.tsx           # ADD "Step N" divider rendering (D-067-03)
├── lib/api.ts                      # READ ONLY — already wires onIterationStart, terminal sentinels
└── types/index.ts                  # ADD `iteration?: number` to ToolCall (D-067-03)

backend/app/api/
├── runs.py                         # PRIMARY DIFF — lines 163, 184 cancellation cleanup (D-067-04)
└── threads.py                      # READ ONLY — iteration_start emit at line 1133 already correct

backend/.env                         # DELETE RUN_HARD_TIMEOUT_SECONDS line (D-067-06)
backend/.env.example                 # cosmetic ref — leave UNTOUCHED (already absent — verified)
.planning/phases/066-…/066-HUMAN-UAT.md  # SC#6 row update (D-067-05)
```

### Pattern 1: `guardedSetMessages` thread-match gate (Phase 063.1 D-063.1-08, extend in D-067-02)

**What:** Two existing `guardedSetMessages` closures inside useMessages.ts gate per-event `setMessages` writes on the user still viewing the thread the run is bound to. They are local closures, not a hook-level helper.

**When to use:** Anywhere the producer-side stream callbacks would otherwise mutate `messages` while the user has navigated to a different thread (Phase 063.1 D-063.1-08 / Gap-003 fix).

**sendMessage flavor (useMessages.ts:544-549):**

```typescript
const guardedSetMessages: typeof setMessages = ((
  update: Parameters<typeof setMessages>[0],
) => {
  if (streamingThreadIdRef.current !== activeThreadIdRef.current) return
  setMessages(update)
}) as typeof setMessages
```

Gate: `streamingThreadIdRef !== activeThreadIdRef` — the original sendMessage is for THIS thread, but the user has navigated away.

**reconcile flavor (useMessages.ts:779-784):**

```typescript
const guardedSetMessages: typeof setMessages = ((
  update: Parameters<typeof setMessages>[0],
) => {
  if (activeThreadIdRef.current !== threadId) return
  setMessages(update)
}) as typeof setMessages
```

Gate: `activeThreadIdRef !== threadId` — the reconcile was for THIS thread, but the user has navigated away.

**The gap (D-067-02):** Both `originalOnTerminal` overrides at lines 561-589 (sendMessage) and 796-826 (reconcile) use plain `setMessages` for the runStatus terminal flip — NOT `guardedSetMessages`. That is deliberate per the comment block at lines 539-543 ("terminal-status flip MUST run regardless of viewing thread") — but the comment's reasoning ("the placeholder needs the correct runStatus when the user navigates back") is correct ONLY when the placeholder still exists. If a thread switch + reconcile fired between deltas and terminal, the placeholder may have been replaced or removed, and writing `runStatus` to a stale `assistantId` is a no-op AT BEST and a UI-flicker race AT WORST.

**Phase 067 fix (recommended):** introduce a third guard that allows the terminal flip when EITHER (a) the user is still on the streaming thread OR (b) the placeholder identified by `assistantId` exists in current state. Pseudocode:

```typescript
const terminalSetMessages: typeof setMessages = ((update) => {
  // Terminal flip is allowed regardless of thread, BUT only when the
  // placeholder assistantId is still in the buffer. If a reconcile or
  // loadMessages collapsed the buffer (e.g. DB caught up + dedup
  // routed away), the flip is a no-op AND the next reconcile will
  // pick up the correct DB-row runStatus via Phase 063.1 D-063.1-13/15.
  setMessages((prev) => {
    if (!prev.some((m) => m.id === assistantId)) return prev
    return typeof update === "function" ? update(prev) : update
  })
}) as typeof setMessages
```

This approach extends D-063.1-08's spirit (no concurrent unguarded `setMessages` writes from different code paths) without breaking the legitimate "write runStatus when the run actually ended" invariant.

### Pattern 2: `reconcileInFlightRef` boolean lock (Phase 063.1 D-063.1-11)

**What:** Single-bit lock at `useMessages.ts:323` (declared) + 700-704 (top-of-reconcile guard) + 868-875 (finally reset). Prevents two concurrent reconciles from racing each other.

**When to use:** ANY future code that could fire reconcile multiple times in a single event loop tick (e.g. visibilitychange + focus on tab activation, mount + visibilitychange on hot-reload).

**Pattern:**

```typescript
const reconcileInFlightRef = useRef(false)

const reconcile = useCallback(async (threadId: string) => {
  if (reconcileInFlightRef.current) return
  reconcileInFlightRef.current = true
  try {
    // ... reconcile body ...
  } finally {
    reconcileInFlightRef.current = false  // ALWAYS reset, even on exception
  }
}, [loadMessages])
```

**Why this matters for Phase 067:** D-067-01 says "extend, don't replace" the existing guard. Any additional in-flight protection introduced (e.g. for the terminal-flip race) MUST follow the same set-before-await + finally-reset pattern. NEVER use a Promise-based mutex (re-entrancy risk in StrictMode) and NEVER use a debounce (D-063.1 deferred ideas list explicitly rejects this).

### Pattern 3: Idempotent SSE replay-tail consumer (Phase 062 + 067)

**What:** `replay_tail_consumer(redis, run_id, since, settings)` at `runs.py:76-225` is an async generator that yields SSE events to `EventSourceResponse`. It has Phase 1 (backlog replay from `since`) and Phase 2 (live-tail BLOCK 5000). Both phases break on TERMINAL_TYPES sentinel.

**When to use:** Any future SSE consumer that needs to combine "replay missed events" with "tail live events" semantics.

**The Phase 067 D-067-04 surgical edit (recommended):**

Currently `runs.py:162-174` has:

```python
try:
    result = await redis.xread(streams={stream_key: last_id}, count=100, block=5000)
except RedisError:
    logger.exception(...)   # ← THIS dumps the full traceback
    yield {"data": json.dumps({"type": "error", "error": "redis_error"})}
    return
```

The recommended pattern adds explicit `asyncio.CancelledError` handling for cooperative cancellation (Phase 059 D-059-04 invariant) AND differentiates `redis.exceptions.TimeoutError` (cancellation-equivalent) from genuine RedisError (real Redis failures):

```python
import redis.exceptions  # MAY need NEW import — verify shadowing rule

try:
    result = await redis.xread(streams={stream_key: last_id}, count=100, block=5000)
except asyncio.CancelledError:
    # Cooperative cancellation — never swallow (Phase 059 D-059-04).
    # Client disconnected; close cleanly without logging a stack trace.
    logger.info(
        "replay_tail_consumer xread (tail phase) cancelled by client disconnect for run %s",
        run_id,
    )
    raise
except RedisError as e:
    # Differentiate TimeoutError (cancellation-equivalent at this site —
    # the only thing a redis.exceptions.TimeoutError on xread BLOCK means
    # is the socket-read deadline elapsed, indistinguishable from a
    # client-side disconnect from this consumer's perspective) from
    # genuine RedisError (real Redis failures — connection reset, OOM,
    # cluster failover, etc).
    from redis.exceptions import TimeoutError as RedisTimeoutError
    if isinstance(e, RedisTimeoutError):
        logger.info(
            "replay_tail_consumer xread (tail phase) socket timeout for run %s "
            "(client likely disconnected)",
            run_id,
        )
    else:
        logger.exception(
            "replay_tail_consumer xread (tail phase) raised RedisError for run %s",
            run_id,
        )
    yield {"data": json.dumps({"type": "error", "error": "redis_error"})}
    return
```

**Variable-shadowing trap (CRITICAL):** The route function `stream_run` at `runs.py:267` declares `redis: aioredis.Redis = Depends(get_redis)`, which shadows the `redis` module name **inside the route body**. The module docstring at lines 24-30 explicitly warns about this. BUT — the `replay_tail_consumer` function at `runs.py:76` is a module-level generator, and its `redis` parameter ALSO shadows the module name inside its body. So the existing `from redis.exceptions import RedisError` top-level import (line 48) is the canonical safe approach. The Phase 067 fix should NOT do `redis.exceptions.TimeoutError` inside `replay_tail_consumer` — instead either (a) import `TimeoutError as RedisTimeoutError` at module level, OR (b) use `isinstance(e, type(RedisError).__subclasses__()...)` (clumsy). Option (a) is cleaner.

The `asyncio.CancelledError` import is ALREADY available — `asyncio` is imported at runs.py:32. Same applies to `await reader.read()` callsites in api.ts on the frontend, but Phase 067 D-067-04 scope is BACKEND-only.

### Pattern 4: Idempotent React reconciliation via deterministic temp ids (Phase 063 + 067)

**What:** The `temp-${run_id}` placeholder id pattern means "same run = same id across reconciles" — React reconciliation merges duplicate inserts as no-ops. Phase 063.1 D-063.1-12 added a MERGE filter that preserves these placeholders when `loadMessages` returns DB rows that haven't yet caught up to the live run.

**When to use:** ANY future placeholder insertion in useMessages.ts. The `makeTempId()` helper (line 31-33) is the legacy random-id generator for sendMessage's user-message placeholder; reconcile uses `temp-${run.run_id}` (deterministic) at line 727 — these are intentionally different shapes because sendMessage's placeholder has no run_id at insert time, while reconcile's always does.

**Phase 067 implication for D-067-01:** any "single state machine" cleanup MUST preserve both shapes:
- sendMessage's flow: `makeTempId()` placeholder → POST returns run_id → stamp run_id on placeholder via setMessages map (line 514-520)
- reconcile's flow: `temp-${run.run_id}` deterministic placeholder → idempotent insert (line 745-749)

### Pattern 5: BL-03 cleanup-belongs-to-onTerminal (Phase 063 + 063.1)

**What:** `subscriptionsRef.current.delete(run_id)` MUST live in the `onTerminal` callback (the moment the producer is actually done), NOT in a promise `finally` chain. Otherwise reconcile() ticks during the still-draining window can't see the subscription and open a duplicate consumer.

**Reference:** useMessages.ts:582 (sendMessage cleanup) and 821 (reconcile cleanup) — both DELETE inside the `originalOnTerminal` override. The `.finally(() => { ... })` at line 853-866 is a SAFETY NET only (catches AbortError + thrown network errors), NOT primary cleanup.

**Phase 067 implication:** any modification to the terminal-flip path (D-067-02) MUST preserve this ordering. The subscription delete MUST run BEFORE `originalOnTerminal(kind, errorPayload)` is invoked (lines 582 and 821) because the upstream callback may trigger downstream effects that read `subscriptionsRef`.

### Anti-Patterns to Avoid

- **Side-effects inside `setMessages` updaters** (Phase 057 deferral §1, Phase 060 D-060-11) — React Strict Mode double-invokes updaters; bail-out optimizations can skip them. The terminal-flip override at lines 568-577 is a PURE state update with no side effects (good); the subscription cleanup at line 582 is OUTSIDE the setMessages call (good); the buffer_expired fallback at line 585-586 is a `loadMessages(threadId).catch(...)` call OUTSIDE the setMessages but BEFORE `originalOnTerminal` — also good. **Do not introduce side effects inside the setMessages callback during the D-067-02 cleanup.**
- **Concurrent setMessages writes from different code paths without a guard** — sendMessage's makeStreamCallbacks, reconcile's makeStreamCallbacks, loadMessages, the catch block at line 609-613 (sets `runStatus: 'failed'` on sendMessage error), and the finally block at line 636-638 (clears `isPlanning`) all converge on `messages` state. Phase 067 D-067-01 says: NO unguarded concurrent writes. Every write must be either (a) inside a guard like `guardedSetMessages` or (b) inside a placeholder-still-exists check.
- **Auto-retry of paid LLM calls** (D-v2.5-05) — Phase 067 must NOT introduce any auto-retry logic. The Resume button is the canonical user-initiated retry surface (Phase 063 D-063-04, Phase 066 D-066-09).
- **Modifying `event_consumer` / `agent_runner` / `_shielded_finalize` in threads.py** (Phase 062 D-062-14) — these are off-limits regions in `threads.py`. Phase 067's only backend touch is `runs.py:163, 184` — confirmed NOT in the carved threads.py off-limits list (Phase 062 only carved threads.py, not runs.py; runs.py was created BY Phase 062).
- **Debounce-based concurrency control** (D-063.1 deferred — explicitly rejected) — fragile against pageshow lateness; adds latency to single legit triggers. Stick with refs + guards.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-flight async lock | Custom Promise-based mutex | Existing `useRef(false)` boolean pattern (`reconcileInFlightRef`, `resumeInFlightRef`) | JavaScript's single-threaded event loop means a synchronously-set boolean is atomic. Promise-based mutexes invite re-entrancy bugs in StrictMode double-invoke. |
| Per-event SSE replay cursor | Custom cursor reset/persist logic | Existing `lastSeenOffsetRef` Map + `onCursor` callback (Phase 063.1 D-063.1-01/02) | Hook-local Map survives tab switches and reconcile cycles within a page lifetime; F5 wipes it (back to `since='0'` on reload — safe because the `runId-match dedup` of D-063.1-04 handles refresh-replay flicker). |
| Cross-thread state mutation guard | Custom thread-id comparison logic at every mutation site | Existing `guardedSetMessages` closure pattern (Phase 060 D-060-01/02 + 063.1 D-063.1-08) | Already battle-tested across phases 060/063.1; D-067-01 mandate is "extend, don't replace." |
| Iteration-boundary partition of tool_calls array | A separate `iterationBoundaries: number[]` derived state | Add `iteration?: number` field on `ToolCall` (Phase 067 D-067-03) | Simpler — stamp the value once at `onToolPreparing`/`onToolStart`, render with `tool_calls.reduce` to inject dividers between consecutive items where `prev.iteration !== curr.iteration`. |
| `redis.exceptions.TimeoutError` cancellation re-classification | Custom string-match on exception message | `isinstance(e, redis.exceptions.TimeoutError)` after catching `RedisError` parent class | Matches the canonical exception-hierarchy pattern; `TimeoutError` IS a subclass of `RedisError` (verified at `backend/venv/Lib/site-packages/redis/exceptions.py:4,12`). |
| LangSmith trace inspection during UAT | grep'ping backend logs for `GeneratorExit` | LangSmith MCP tool (project dashboard trace tree) | Backend log greps are NOT a substitute (D-067-07 explicit). Trace's exception column is the source of truth for `GeneratorExit` absence. |

**Key insight:** Every "should I build this?" question for Phase 067 has an existing answer in the 060→063.1→066 codebase. The phase is exclusively a polish pass on existing infrastructure — it ships NO new architectural surface, NO new env vars (removes one), NO migrations, NO new dependencies.

## Common Pitfalls

### Pitfall 1: Modifying the iteration-loop body without preserving the for-loop byte-identical content

**What goes wrong:** Phase 063.1 plan 04 SUMMARY documents that re-indenting ~150 lines of for-loop body to wrap in a new try/finally is byte-identical work — the inner content stays untouched, only structural wrapping changed. If Phase 067 D-067-01's "single state machine" cleanup re-indents the for-loop body of reconcile (lines 713-867), the diff will balloon and risk subtle drift in dedup/cursor/onTerminal blocks.

**Why it happens:** Refactoring impulse — "while we're here, let's clean up the formatting." DON'T.

**How to avoid:** Plan-phase explicit acceptance criterion: "for-loop body in reconcile is byte-identical to current state; only structural wrapping changed." Mirror Phase 063.1 plan 04 acceptance criterion #5.

**Warning signs:** Diff for `useMessages.ts` exceeds ~100 lines on the reconcile function alone.

### Pitfall 2: Importing `redis.exceptions.TimeoutError` inside the route body where `redis` is shadowed by Depends parameter

**What goes wrong:** Inside `stream_run` (runs.py:267) and `cancel_run` (runs.py:361), the parameter `redis: aioredis.Redis = Depends(get_redis)` shadows the `redis` module name. Writing `redis.exceptions.TimeoutError` would dereference `.exceptions` on the Redis INSTANCE — AttributeError at runtime.

**Why it happens:** Convenient IDE auto-import — `redis.exceptions.TimeoutError` looks natural.

**How to avoid:** Import `TimeoutError as RedisTimeoutError` at module top (mirror the existing `from redis.exceptions import RedisError` at line 48). Or do the type check with `RedisError` and `e.__class__.__name__ == 'TimeoutError'` (less clean — avoid).

**Warning signs:** AttributeError in test runtime; module docstring at runs.py:24-30 explicitly flags this.

### Pitfall 3: Deleting "Saving response…" without auditing every fallback render path

**What goes wrong:** MessageItem.tsx:140 is one of TWO "Saving response…"-equivalent strings. Line 130-150 has the fallback inside the `hasAnyTools && !isStreaming && !runStatus-keyed-banner` branch. Line 161-165 has a SECOND banner block with `(message.stopped || message.runStatus === "timed_out")` that already correctly handles `timed_out` and `cancelled`. Deleting line 140 without checking line 161-165 could leave a different fallback path that surfaces "Saving response…" in a different state.

**Why it happens:** "It's just one line" mentality.

**How to avoid:** Plan-phase grep: `grep -n "Saving response" frontend/src/` should return ZERO matches after the fix. Verify in Chrome MCP that the synthesizing-tools-but-no-content state shows only "Working" or "Synthesizing answer" — no "Saving response…" anywhere.

**Warning signs:** Code review or live UAT surfaces "Saving response…" in any state.

### Pitfall 4: Iteration-boundary divider rendered for first iteration

**What goes wrong:** A naive D-067-03 implementation renders a divider above EVERY tool call where the iteration changed — including iteration 0 (the first one). Visual result: the panel opens with `──── Step 1 ──────` as a dead first line.

**Why it happens:** `tool_calls.reduce((acc, tc, i) => i === 0 || acc[acc.length - 1].iteration !== tc.iteration ? [...acc, divider, tc] : [...acc, tc])` is wrong on i === 0.

**How to avoid:** Render divider ONLY when `i > 0 && tool_calls[i].iteration !== tool_calls[i-1].iteration`. CONTEXT.md Claude's Discretion explicitly recommends "first iteration MAY render without an explicit Step 1 divider above it" — confirm this during plan-phase.

**Warning signs:** Chrome MCP screenshot shows divider above the first tool of every assistant message.

### Pitfall 5: ToolCall objects loaded from DB lack the `iteration` field

**What goes wrong:** D-067-03 adds `iteration?: number` to ToolCall. Live-streamed tool calls get the value at `onToolPreparing`/`onToolStart` from a tracked counter. But persisted ToolCall objects loaded via `getMessages` from the DB have NO iteration field — that data was never persisted in the schema. When the user F5s mid-stream and reconciles, the tool calls reloaded from DB will have `undefined` iteration.

**Why it happens:** Frontend type extension is decoupled from backend schema.

**How to avoid:** Render dividers ONLY when `iteration` is defined AND consecutive tool calls have different defined values. If all values are undefined (DB-loaded), render the panel without dividers (acceptable UX — historical messages don't need step boundaries; the run is already complete).

**Warning signs:** Chrome MCP test of historical message renders with malformed dividers.

### Pitfall 6: Removing `RUN_HARD_TIMEOUT_SECONDS` from `.env` without verifying Pydantic still ignores it on existing deploys

**What goes wrong:** Phase 066 D-066-12 says the env var is "silently parsed-and-ignored" via Pydantic `extra="ignore"`. Verified at `backend/app/config.py:368-371`. But if a deploy has the var set AND Pydantic config drift removes the `extra="ignore"` setting (someone changes it to `extra="forbid"` in a future refactor), the deploy will refuse to start.

**Why it happens:** Future-proofing concern — the safety relies on a config setting that could change.

**How to avoid:** Plan-phase verifies Settings class still has `extra="ignore"` (or equivalent) AFTER the line removal. Since D-067-06 only DELETES references (not the Pydantic config), this is a passive concern — but worth a verify-block grep.

**Warning signs:** Backend startup error mentioning unknown setting `RUN_HARD_TIMEOUT_SECONDS`.

## Code Examples

Verified patterns from official sources and current codebase.

### Setting up the terminal-flip guard (Phase 067 D-067-02 — recommended)

```typescript
// Source: useMessages.ts:560-589 (current sendMessage) — recommended modification
const originalOnTerminal = callbacks.onTerminal
callbacks.onTerminal = (kind, errorPayload) => {
  // D-067-02: terminal-flip guard. Allows the runStatus mutation IFF the
  // placeholder identified by `assistantId` still exists in current state.
  // If a thread switch + reconcile collapsed the buffer in between deltas
  // and terminal, writing runStatus to a stale id is a no-op; the next
  // reconcile will pick up the correct DB-row runStatus via Phase 063.1
  // D-063.1-13/15 LEFT JOIN.
  setMessages((prev) => {
    if (!prev.some((m) => m.id === assistantId)) return prev
    return prev.map((m) => {
      if (m.id !== assistantId) return m
      if (kind === "done") return { ...m, runStatus: "completed" }
      if (kind === "error") return { ...m, runStatus: "failed" }
      if (kind === "timed_out") return { ...m, runStatus: "timed_out", stopped: true }
      // kind === "cancelled"
      return { ...m, runStatus: "cancelled", stopped: true }
    })
  })
  // BL-03 — subscriptionsRef cleanup belongs HERE, not in finally
  if (registeredRunId) subscriptionsRef.current.delete(registeredRunId)
  // Pitfall 8 — TTL-expired buffer fallback to loadMessages
  if (errorPayload === "buffer_expired") {
    loadMessages(threadId).catch(console.error)
  }
  originalOnTerminal(kind, errorPayload)
}
```

### Removing the "Saving response…" fallback (D-067-02)

```tsx
// Source: MessageItem.tsx:130-150 — recommended modification
//
// BEFORE (line 134-141):
//   {isStreaming
//     ? (allToolsDone ? "Synthesizing answer" : "Working")
//     : message.runStatus === "timed_out"
//       ? "Agent reached time limit"
//       : message.runStatus === "cancelled" || message.stopped
//         ? "Response stopped"
//         : "Saving response…"}      // ← DELETE this line
//
// AFTER (recommended):
{isStreaming
  ? (allToolsDone ? "Synthesizing answer" : "Working")
  : message.runStatus === "timed_out"
    ? "Agent reached time limit"
    : message.runStatus === "cancelled" || message.stopped
      ? "Response stopped"
      : null}   // No fallback — terminal states only carry text; mid-flight states with no isStreaming render nothing
```

If `null` causes the parent `<span>` to render an orphaned bouncing-dots animation (line 142-148), the parent must also short-circuit when no banner text is selected. Plan-phase verifies via Chrome MCP visual inspection.

### Adding `iteration` field on ToolCall (D-067-03)

```typescript
// Source: types/index.ts:28-43 — recommended addition
export interface ToolCall {
  name: string
  id?: string
  args: Record<string, string>
  status: "running" | "done" | "interrupted" | "preparing"
  /** D-067-03: 0-based iteration index from iteration_start SSE event. Used by
   * ToolCallPanel to render "Step N" gradient dividers between iteration groups.
   * Undefined for tool calls loaded from DB (historical messages — no divider). */
  iteration?: number
  result?: string
  sub_agent?: SubAgentState
  startedAt?: number
  endedAt?: number
  outputLines?: OutputLine[]
  outputFiles?: OutputFile[]
  executionDurationMs?: number
  exitCode?: number
  errorMessage?: string
}
```

### Cancellation-aware xread cleanup (Phase 067 D-067-04)

```python
# Source: backend/app/api/runs.py:162-174 — recommended modification

# At module top (after line 48):
from redis.exceptions import RedisError, TimeoutError as RedisTimeoutError

# Inside replay_tail_consumer Phase 2 (current line 162-174):
try:
    result = await redis.xread(
        streams={stream_key: last_id},
        count=100,
        block=5000,
    )
except asyncio.CancelledError:
    # D-067-04: cooperative cancellation — never swallow (Phase 059 D-059-04).
    # Client disconnected; close cleanly with INFO log, no stack trace.
    logger.info(
        "replay_tail_consumer xread (tail phase) cancelled by client disconnect for run %s",
        run_id,
    )
    raise
except RedisTimeoutError:
    # D-067-04: socket-read deadline elapsed — cancellation-equivalent at this
    # site (the only thing it means here is the consumer's blocking xread was
    # interrupted while no client was actively listening). Close cleanly with
    # INFO log, no stack trace; do NOT propagate as 503 (client already gone).
    logger.info(
        "replay_tail_consumer xread (tail phase) socket timeout for run %s "
        "(client likely disconnected)",
        run_id,
    )
    yield {"data": json.dumps({"type": "error", "error": "redis_timeout"})}
    return
except RedisError:
    # Genuine RedisError (connection reset, OOM, cluster failover, etc.) —
    # keep full traceback for diagnostics.
    logger.exception(
        "replay_tail_consumer xread (tail phase) raised RedisError for run %s",
        run_id,
    )
    yield {"data": json.dumps({"type": "error", "error": "redis_error"})}
    return
```

Apply the same pattern to the post-BLOCK exists-probe at runs.py:184-196 (it already has `except (RedisError, OSError)` at line 190 — extend with the CancelledError + RedisTimeoutError discrimination).

## Runtime State Inventory

> Phase 067 has minor refactor-with-side-effects scope; the inventory is non-empty but small.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — Phase 067 ships NO migrations, NO schema changes, NO data migrations. | None. |
| **Live service config** | None — no n8n, Datadog, Cloudflare, or external-UI-managed services in this codebase scope. | None. |
| **OS-registered state** | None — no Windows Task Scheduler / launchd / systemd registrations affected. | None. |
| **Secrets/env vars** | `RUN_HARD_TIMEOUT_SECONDS=600` line in `backend/.env` (verified by Phase 066 stopgap doc + grep results). May also exist in `.env.example` (could not directly read due to permission policy — plan-phase verifies via grep). May appear in `supabase/SETUP.md` and `REDIS-SETUP.md` as cosmetic ref. **D-067-06 deletes all of these.** No secret rotation; no code reference to delete (already removed by Phase 066 D-066-01). | Code edit (delete line). |
| **Build artifacts / installed packages** | Frontend: `frontend/node_modules/vitest@4.1.0` is FUNCTIONAL on this machine — Phase 063.1/066 vitest-unavailable constraint is RESOLVED. `frontend/node_modules/@rolldown/binding-win32-x64-msvc/` present. No stale build artifacts. Backend: `backend/venv/Lib/site-packages/redis-5.3.1.dist-info/` (current). No reinstall needed. | None — environment is current. |

**The canonical question:** *After every Phase 067 file edit lands, what runtime systems still have the old behavior cached, stored, or registered?*

**Answer:** Nothing. Phase 067 is exclusively a code+config edit. Backend restart picks up the runs.py + .env changes. Frontend HMR picks up the React/Tailwind changes. No data migration. No external service reconfiguration. Verified — no missed runtime state.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Frontend dev server | Chrome MCP UAT (D-067-07) | ✓ | localhost:5173 | Run `npm run dev` in `frontend/` |
| Backend dev server | Chrome MCP UAT, Supabase MCP queries, LangSmith trace generation | ✓ | localhost:8000 | Run `cd backend && venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000` |
| Supabase local stack | Live `runs` row inspection (D-067-07) | ✓ | (managed by Supabase CLI on Docker Desktop boot per CLAUDE.md) | If down: `supabase start` from repo root |
| Redis | Live SSE streaming + cancellation testing | ✓ | Running via `docker-compose.dev.yml` (Phase 061+) | If down: `docker compose -f docker-compose.dev.yml up -d` |
| LangSmith MCP / dashboard access | SC#7 trace inspection (D-067-05) | Assumed ✓ — was used during Phase 066 UAT | Project trace dashboard | None — D-067-07 explicitly REQUIRES this; not having it blocks SC#7 verification |
| Chrome DevTools MCP | All visual UI verification (D-067-07) | ✓ per memory `feedback_chrome_mcp_testing.md` | latest | None — Chrome MCP is REQUIRED per D-067-07 |
| Supabase MCP / CLI | runs-row queries during UAT | ✓ per memory `reference_local_dev_app.md` | latest | `supabase` CLI in repo root |
| `vitest` (frontend unit tests) | OPTIONAL — Phase 067 does NOT mandate unit tests but they're now available | ✓ NEW | 4.1.0 | None needed — but per Phase 063.1/066 precedent, deferring to `tsc --noEmit` is acceptable |
| `npx tsc --noEmit -p tsconfig.json` (frontend type-check) | All frontend edits (D-067-01, D-067-02, D-067-03) | ✓ (TypeScript transitively from frontend/package.json) | latest | None — gating signal |
| `pytest` + Phase 066 integration tests | Phase 067 does NOT add backend integration tests; existing test_066_*.py suite is the regression baseline | ✓ | (from backend/requirements*.txt) | None |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Note on vitest availability:** Phase 063.1 and 066 deferred all runtime test execution because `npm install` failed to install `@rolldown/binding-win32-x64-msvc` and `@jridgewell/sourcemap-codec`. As of this research session (2026-05-07), `npx vitest --version` returns `vitest/4.1.0 win32-x64 node-v22.14.0` and `frontend/node_modules/@rolldown/binding-win32-x64-msvc/` exists. The constraint is RESOLVED. Plan-phase MAY add unit tests for the state-machine cleanup (D-067-01/02), but is NOT required to — Chrome MCP live UAT remains the canonical verification per D-067-07. Recommend: add unit tests if the diff exceeds ~50 lines of state-machine logic; skip them if the diff is purely structural rewrapping of existing logic.

## Validation Architecture

> Required per `workflow.nyquist_validation: true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Frontend unit framework | `vitest@4.1.0` (FUNCTIONAL on this machine — verified `npx vitest --version`) |
| Frontend config file | `frontend/vite.config.ts` + `frontend/vitest.config.ts` (verify in plan-phase) |
| Frontend type-check command | `cd frontend && npx tsc --noEmit -p tsconfig.json` |
| Frontend test command (now usable) | `cd frontend && npx vitest run` |
| Backend integration framework | `pytest` |
| Backend test command | `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_066_*.py -v` (regression baseline) |
| Backend module-target test command | `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_062_*.py -v` (runs.py cancellation regression — verify if exists) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| UX-067-01 (first-paint) | Submitting a long-running prompt renders backend events in real-time on the chat surface — no extended empty period, no manual refresh | live (Chrome MCP) + optional unit (vitest test of guarded terminal-flip) | Chrome MCP: navigate to localhost:5173/, login, submit slow-tool prompt, observe placeholder→delta→terminal sequence in DOM | ❌ Wave 0 — new chrome-MCP scenario |
| UX-067-02 (runStatus sync) | "Saving response…" indicator NEVER surfaces mid-stream while events still flow | grep + Chrome MCP | `grep -n "Saving response" frontend/src/` → 0 matches; Chrome MCP visual inspection during slow-tool run shows only "Working"/"Synthesizing answer" | ❌ Wave 0 — new grep gate + Chrome MCP scenario |
| UX-067-03 (refresh-recovery) | F5/tab-restore continues to work; refresh becomes recovery-only path | live (Chrome MCP) — regress against Phase 063.1 | Chrome MCP: F5 mid-stream, observe replay-tail wires correctly + no duplicate bubble (Gap-001 regression guard) | ❌ Wave 0 — leverage existing `e2e/tests/063.1-refresh-no-duplicate-bubble.spec.ts` if vitest harness extends to e2e |
| UX-067-04 (Redis consumer cleanup) | SSE client disconnects log at INFO/DEBUG; no `redis.exceptions.TimeoutError` traceback | grep + integration test + live | `grep -n "redis.exceptions.TimeoutError" backend/logs/*.log` → 0 matches during a Chrome MCP refresh test; integration test asserts no traceback in caplog | ❌ Wave 0 — new pytest test_067_runs_cancellation.py |
| UX-067-05 (iteration boundaries) | Multi-iteration agent runs surface clear iteration boundaries via "Step N" divider | grep + Chrome MCP visual | `grep -n "Step.*divider\|StepDivider" frontend/src/components/chat/ToolCallPanel.tsx` → ≥1 match; Chrome MCP screenshot of multi-iteration run shows divider between groups | ❌ Wave 0 — new test or visual check |
| Phase 066 SC#6 closure | Synthetic per-call timeout renders banner + Resume button + LangSmith clean trace | live (Chrome MCP + Supabase MCP + LangSmith MCP) | See "## Live UAT closing protocol" below — verbatim Phase 066 Plan 05 Task 2 protocol | ❌ Wave 0 — Plan 05 of Phase 067 owns this closing UAT |

### Sampling Rate

- **Per task commit:** `cd frontend && npx tsc --noEmit -p tsconfig.json` (always — non-blocking on every commit)
- **Per task commit (frontend changes):** `grep -c "<acceptance-criterion-pattern>" <file>` (per the plan's `<verify>` block, mirror Phase 063.1 plan 04 grep-gate style)
- **Per task commit (backend changes):** `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_066_*.py -v` (regression baseline — must stay green)
- **Per wave merge:** Full integration suite + chrome-mcp scenario for that wave's user-visible change
- **Phase gate:** Live UAT closing protocol (D-067-05) green; SC#6 row in 066-HUMAN-UAT.md updated `deferred` → `green`; orchestrator runs `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/hooks/__tests__/useMessages.test.ts` — vitest unit test for guarded terminal-flip (D-067-02). Optional — defer if D-067-01/02 diff stays small.
- [ ] `backend/tests/integration/test_067_runs_cancellation.py` — pytest test asserting `replay_tail_consumer` cleanly handles `asyncio.CancelledError` (re-raises) and `redis.exceptions.TimeoutError` (logs INFO, no traceback in caplog). REQUIRED for D-067-04 verification.
- [ ] Chrome MCP test scenarios — encoded as runbook steps in 067-HUMAN-UAT.md (mirror Phase 063.1 / 066 HUMAN-UAT.md shape):
  - Scenario A (UX-067-01): submit slow-tool prompt; observe placeholder→delta→terminal sequence; no manual refresh required
  - Scenario B (UX-067-02): submit slow-tool prompt; verify "Saving response…" never appears mid-stream
  - Scenario C (UX-067-03): F5 mid-stream; verify replay-tail wires correctly, no duplicate bubble
  - Scenario D (UX-067-04): F5 with active stream; check backend logs for absent `redis.exceptions.TimeoutError` traceback
  - Scenario E (UX-067-05): submit prompt that triggers multi-iteration tool flow; verify "Step N" dividers visible between iteration groups
  - Scenario F (SC#6 closure): D-067-05 synthetic timeout protocol verbatim

*(If wave 0 deferral is approved by orchestrator: chrome-mcp scenarios become runbook checklists in 067-HUMAN-UAT.md; vitest unit tests become OPTIONAL).*

## Live UAT closing protocol (D-067-05)

This is verbatim the Phase 066 Plan 05 Task 2 protocol. Plan-phase MUST embed this in 067-05's `<how-to-verify>` block.

### A. Pre-flight (executor configures)

1. Confirm dev app is running:
   ```bash
   curl -fsS http://localhost:5173/ > /dev/null && echo "frontend up" || echo "frontend DOWN"
   curl -fsS http://localhost:8000/health > /dev/null && echo "backend up" || echo "backend DOWN"
   ```

2. Add `LLM_CALL_TIMEOUT_OVERRIDES=<active-model>=10` to `backend/.env`. Query active model first:
   ```bash
   cd backend && venv/Scripts/python.exe -c "from app.config import settings; print(settings.llm_model)"
   ```

3. Restart backend so Pydantic re-parses the env var.

4. Verify the override is loaded:
   ```bash
   cd backend && venv/Scripts/python.exe -c "from app.config import get_per_call_timeout, settings; print(get_per_call_timeout(settings.llm_model, settings))"
   ```
   Expected: `10`.

### B. User-driven test

5. In Chrome MCP, navigate to localhost:5173/, login as `fhdmrd@gmail.com / 123456`, create a new thread, submit:
   ```
   Explain quantum mechanics in extensive detail. Include the historical development from Planck onwards, all major interpretations (Copenhagen, Many-Worlds, Pilot Wave, Consistent Histories, Relational, QBism), and 10 detailed worked-example calculations showing wavefunction collapse, entanglement, and tunneling. Take your time and be thorough.
   ```

6. Observe in Chrome MCP DOM (within ~10-15s):
   - Streaming briefly appears (delta tokens may render before timer fires)
   - Chat renders **"Agent reached time limit"** italic text below the assistant bubble (MessageItem.tsx:163)
   - **Resume** button (RotateCcw icon) appears below the assistant bubble (MessageItem.tsx:104-114)
   - **NO** "Response stopped" text (that's the cancelled-path banner — wrong for this scenario)
   - **NO** "Saving response…" text (D-067-02 deletion verified)

7. Click Resume. Expected:
   - New POST `/threads/{tid}/messages` fires (Chrome MCP network panel)
   - New assistant placeholder appears
   - With 10s budget still in place, this run will ALSO timed_out — that's fine; the test is whether Resume re-fires successfully

8. Supabase MCP / CLI verification:
   ```sql
   SELECT status, error, completed_at - started_at AS elapsed
   FROM public.runs
   WHERE thread_id='<your-thread-id>'
   ORDER BY started_at DESC LIMIT 1;
   ```
   Expected: `status = 'timed_out'`, `error LIKE 'timed_out: 10s per-call deadline exceeded at iteration % (model=%)'`

9. LangSmith MCP / dashboard inspection:
   - Open project trace dashboard
   - Find the synthetic-timeout run from step 5
   - Inspect trace tree
   - Required observation: trace ENDS with `TimeoutError` or clean stream-end. NO `GeneratorExit` warning at `langsmith/run_helpers.py:1680` in the trace's exception column.

### C. Cleanup

10. Remove `LLM_CALL_TIMEOUT_OVERRIDES=<model>=10` from `backend/.env` (or set to a sensible production value).
11. Restart backend.
12. Update `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md` SC#6 row from `deferred` → `green` with concrete evidence (run_id, timestamps, trace URL).

### D. Important note on protocol drift

CONTEXT.md `<specifics>` line "synthetic per-call timeout (`per_call_budget=1` against `slow_llm_response_seconds=2`)" is an **inaccurate paraphrase**. The ACTUAL Phase 066 Plan 05 Task 2 protocol uses:
- `LLM_CALL_TIMEOUT_OVERRIDES=<active-model>=10` (the per-call budget override env var, NOT a `per_call_budget=1` field)
- A real LLM call against a deliberately-slow prompt (NOT a `slow_llm_response_seconds=2` fixture)

The `slow_llm_response_seconds` symbol does NOT exist in the codebase (verified via grep — 0 matches in `backend/`). The `ENABLE_TEST_FIXTURES=1` route at `backend/app/api/test_fixtures.py:43` provides `inject_failed_run` ONLY — it does NOT inject slow-LLM fixtures. **Plan-phase MUST use the real `LLM_CALL_TIMEOUT_OVERRIDES` env protocol, not the misnamed `slow_llm_response_seconds` fiction.**

## Validation Detail per Success Criterion

This section is consumed by `gsd-plan-checker` for Dimension 8 verification. Each row maps to a single observable evidence anchor.

| SC | Live-tooling check | Acceptance-criterion grep target | Negative-evidence (MUST be absent) |
|----|---|---|---|
| UX-067-01 (first-paint) | Chrome MCP: submit slow-tool prompt; DOM contains assistant placeholder within ≤500ms of submit; subsequent delta tokens render WITHOUT manual refresh; final terminal banner correct | `grep -c "if (!prev.some((m) => m.id === assistantId))" frontend/src/hooks/useMessages.ts` ≥ 1 (terminal-flip-with-existence-check pattern, OR equivalent guard cited in plan) | Empty chat surface for >5s after submit; "manual refresh required" UX state — verified by Chrome MCP screenshot at t=3s, t=10s |
| UX-067-02 (runStatus sync) | Chrome MCP: during a multi-iteration tool run, the screen NEVER shows "Saving response…" while delta tokens are still streaming | `grep -n "Saving response" frontend/src/` → 0 matches | "Saving response…" string anywhere in DOM during isStreaming=true |
| UX-067-03 (refresh recovery) | Chrome MCP: F5 mid-stream; assistant bubble reappears via replay-tail; final content matches no-refresh equivalent run | Existing `e2e/tests/063.1-refresh-no-duplicate-bubble.spec.ts` regression — `npm run e2e -- 063.1-refresh-no-duplicate-bubble` exits 0 | Duplicate assistant bubble during replay window; missing replay-tail subscription on reload |
| UX-067-04 (Redis cleanup) | Chrome MCP: F5 to disconnect SSE; backend log inspection shows ZERO `redis.exceptions.TimeoutError` traceback lines from runs.py:163 or :184 over a 30s window | `grep -c "redis_timeout\|cancelled by client disconnect" backend/app/api/runs.py` ≥ 1 (new INFO log message present) AND `grep -c "logger.exception.*xread.*tail.*RedisError" backend/app/api/runs.py` decreases by ≥1 (TimeoutError branch is now INFO not exception) | `redis.exceptions.TimeoutError: Timeout reading from localhost:6379\n  File "...runs.py", line 163` traceback in backend logs after a tab cycle |
| UX-067-05 (Step N dividers) | Chrome MCP: submit a prompt that triggers ≥2 iteration boundaries; visual confirmation of `──── Step 2 ────────` style divider between iteration groups | `grep -c "iteration" frontend/src/types/index.ts` ≥ 1 (ToolCall has iteration field — D-067-03); `grep -c "Step.*{.*iteration" frontend/src/components/chat/ToolCallPanel.tsx` ≥ 1 (divider rendering) | First iteration renders WITH a "Step 1" divider above it (visual regression — Pitfall 4); divider visible on a single-iteration run; divider visible on historical (DB-loaded) messages with no iteration data |
| Phase 066 SC#6 closure | Chrome MCP: D-067-05 protocol verbatim — banner + Resume + click re-POST; Supabase: `runs.status='timed_out'`; LangSmith: trace exception column shows `TimeoutError` (NOT `GeneratorExit`) | Updated SC#6 row in `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md` — `green` status with concrete evidence (run_id, timestamps, trace URL); `grep -c "deferred" .planning/phases/066-…/066-HUMAN-UAT.md` decreases by 1 | `runs.status` not equal to `'timed_out'` after the synthetic-timeout run; `GeneratorExit` warning at `run_helpers.py:1680` in LangSmith trace; "Saving response…" banner instead of "Agent reached time limit" |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 4-value `runs.status` enum (`streaming`, `completed`, `failed`, `cancelled`) | 5-value enum + `timed_out` | Phase 066 D-066-04 (migration 038) | Backend lifecycle now distinguishes user-initiated Stop from system-fired per-call timeout. Frontend renders distinct banner per state. |
| 120s `RUN_HARD_TIMEOUT_SECONDS` `asyncio.timeout()` wrapping the entire agent loop | Per-LLM-call `asyncio.timeout(per_call_budget)` resetting on each iteration; no overall total cap | Phase 066 D-066-01/02 | Long multi-tool agents (proven by 9m02s run `95e3447c-…`) complete cleanly. Phase 067 D-067-06 removes the dead env var symbol. |
| `redis.exceptions.TimeoutError` from xread BLOCK logged as full traceback | INFO log + clean SSE error event (Phase 067 D-067-04) | Phase 067 (this phase) | Tab cycles no longer pollute backend logs with stack traces; cooperative cancellation invariant preserved. |
| Hard-coded `since="0"` at all subscribeToRun call sites | `lastSeenOffsetRef` Map + per-event `onCursor` cursor advancement | Phase 063.1 D-063.1-01/02 (Gap-004) | Reconcile after tab switch resumes from last-seen offset, not from stream start. |
| Per-event `setMessages` writes from sendMessage callbacks unguarded | `guardedSetMessages` thread-match closure | Phase 063.1 D-063.1-08 (Gap-003) | Cross-thread state mutation eliminated for delta callbacks. Phase 067 D-067-02 extends this to terminal-flip callbacks. |
| Single `loadMessages(threadId)` REPLACE on reconcile | MERGE-preserving live `temp-` placeholders | Phase 063.1 D-063.1-12 (Gap-005) | Concurrent reconcile triggers don't wipe in-flight placeholders. |
| `getMessages` returned raw DB rows without `runStatus` | LEFT JOIN `public.runs ON messages.id = runs.message_id` returns `run_id` + `run_status` | Phase 063.1 D-063.1-13/15 | Reload of a `failed` run renders Resume button correctly. Foundation for Phase 067 D-067-03 (no new join needed). |
| ToolCall flat array, single-header "Step N" label only | `iteration` field per ToolCall + render dividers between iteration groups | Phase 067 D-067-03 (this phase) | Multi-iteration agent runs visually surface step boundaries — no longer perceived as a runaway loop. |

**Deprecated/outdated:**
- **`RUN_HARD_TIMEOUT_SECONDS` env var.** Consumer (the `asyncio.timeout(...)` wrapper) was deleted in Phase 066 D-066-01. Pydantic Settings `extra="ignore"` silently drops the value at startup since Phase 066. Phase 067 D-067-06 removes the documentation/.env references. After Phase 067 lands, no remaining reference except in historical phase docs (acceptable).
- **vitest-unavailable assertion in 063.1/066 plan SUMMARYs.** AS OF 2026-05-07 RESEARCH SESSION: vitest is functional. `feedback_chrome_mcp_testing.md` memory still recommends Chrome MCP as the primary verification — that guidance remains correct per D-067-07. But unit tests can supplement Chrome MCP if the planner deems them valuable.
- **`slow_llm_response_seconds=2` / `per_call_budget=1`** test-fixture wording in CONTEXT.md `<specifics>`. The actual fixture mechanism is `LLM_CALL_TIMEOUT_OVERRIDES=<model>=10` env var, not a fixture. Plan-phase MUST use the verified protocol.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Frontend React version is 19.x based on import patterns and Vite + package.json deps. | Standard Stack (Core) | LOW — Phase 067 doesn't depend on a specific React version; concurrent-mode behavior of useState bail-outs is consistent across 18.x and 19.x. |
| A2 | LangSmith MCP is available and works for trace inspection during D-067-05 closing UAT (it was used in Phase 066 SC#7 verification per 066-HUMAN-UAT.md). | Environment Availability | MEDIUM — if LangSmith MCP is unavailable, SC#6 closure can't be verified. Fallback: manual browse to LangSmith dashboard URL during UAT — still satisfies the "trace exception column shows TimeoutError" requirement. |
| A3 | `backend/.env.example` does NOT contain `RUN_HARD_TIMEOUT_SECONDS` (could not directly read due to permission policy; CONTEXT.md says "if present"). | User Constraints (D-067-06), Pitfall 6 | LOW — D-067-06 says "delete if present"; absent is acceptable. Plan-phase verifies via grep (likely permission allows grep but not direct read). |
| A4 | The recommended D-067-02 fix (existence-check guard on terminal flip) is the correct interpretation of CONTEXT.md's "tighten terminal-flip to be guard-aware" without breaking refresh-recovery (replay-tail) or temp-placeholder MERGE-preserve filter. | Code Examples (Setting up the terminal-flip guard) | MEDIUM — alternative interpretations include extending guardedSetMessages to gate on activeThreadIdRef strictly. Plan-phase should locked the exact pattern via discuss with user OR derive from test cases. |

**Items the planner MUST confirm during plan-phase:**
- A2 — Confirm LangSmith MCP availability before scoping the SC#6 protocol re-run.
- A4 — Confirm with user whether the existence-check pattern is correct, or whether to extend `guardedSetMessages` differently.

## Open Questions

1. **Should D-067-03's `iteration` field be optional or required on ToolCall, and how to handle DB-loaded historical messages?**
   - What we know: iteration field is added per Phase 067 D-067-03; live-streamed tools get it from `onIterationStart` counter; DB-loaded ToolCall objects don't have it.
   - What's unclear: whether to render the panel WITHOUT dividers when all values are undefined (clean — recommended), or to derive iteration from tool-call ordering heuristics (clever but lossy).
   - Recommendation: clean — no dividers on historical messages. Pitfall 5 explicitly addresses this. Confirm during plan-phase.

2. **Is the "Saving response…" deletion truly safe when no `runStatus` is set on a placeholder?**
   - What we know: line 161-165 has a SECOND banner block keyed on `(message.stopped || message.runStatus === "timed_out")` — handles cancelled and timed_out cases. Line 130-150 has the first banner inside `hasAnyTools && !isStreaming`.
   - What's unclear: edge case where `isStreaming=false`, `hasAnyTools=true`, `runStatus=undefined`, `stopped=false` — the in-content branch (line 134-141) currently falls through to "Saving response…". After D-067-02, this falls through to `null`. Visually: tools have run, no content, no spinner, no banner — does this state actually occur on a healthy run?
   - Recommendation: the state COULD occur briefly between `stream_end` SSE arrival (terminal flip flips runStatus) and `loadMessages` refetch (which writes the persisted DB row's `runStatus`). Verify in Chrome MCP that the brief gap doesn't cause visible "blank tool panel with nothing" flicker. If it does, plan-phase decides: (a) accept brief flicker; (b) keep a minimal fallback string like "…" (single ellipsis); (c) audit backend SSE emission to ensure `stream_end` is the LAST event from the producer (closing this gap at the source).

3. **Does the existing `e2e/tests/063.1-refresh-no-duplicate-bubble.spec.ts` regression test cover D-067-03 first-paint without modification?**
   - What we know: 063.1 e2e specs were authored in `2ce760f`, `183b041` per Phase 063.1 plan 05. They run via Playwright.
   - What's unclear: whether Playwright/e2e harness is functional on this machine (separate from vitest's resolved status).
   - Recommendation: plan-phase verifies via `cd e2e && npx playwright --version` (or equivalent). If functional, leverage existing specs; if not, defer to Chrome MCP runbook scenarios.

4. **Does `replay_tail_consumer` need similar cancellation hygiene at the Phase 1 (replay) xread call site (runs.py:104-117), in addition to Phase 2 (live-tail)?**
   - What we know: D-067-04 explicitly cites runs.py:163 (Phase 2 live-tail) and runs.py:184 (post-BLOCK exists probe) — but NOT runs.py:104 (Phase 1 replay).
   - What's unclear: Phase 1's xread is non-blocking (no `block=` arg) and returns immediately — much less likely to trigger socket-read deadline errors. But cooperative cancellation (CancelledError on disconnect) could still raise during the await.
   - Recommendation: plan-phase decides whether to extend the cancellation handling to all three xread call sites or stick to the two cited in CONTEXT.md. Recommend: extend to all three for consistency — the diff is symmetric and defensive.

## Sources

### Primary (HIGH confidence — direct code read)

- `frontend/src/hooks/useMessages.ts` (FULL READ, lines 1-957) — verified D-067-01/02 hot-spots: line 274 (onIterationStart), lines 323/700-704/874 (reconcileInFlightRef), lines 381-445 (loadMessages with MERGE filter at 426-439), lines 447-681 (sendMessage), lines 544-549 (sendMessage's guardedSetMessages), lines 560-589 (UNGUARDED terminal flip in sendMessage — line 568 uses plain setMessages), lines 690-876 (reconcile), lines 779-784 (reconcile's guardedSetMessages), lines 795-826 (UNGUARDED terminal flip in reconcile — line 807 uses plain setMessages).
- `frontend/src/components/chat/ChatArea.tsx` (FULL READ, lines 1-313) — verified D-067-01 trigger surface at 79-127 (thread-switch effect; abortStream removed per D-063.1-07; clearMessages still called) and 158-188 (visibilitychange/focus/pageshow listeners through reconcileRef).
- `frontend/src/components/chat/MessageItem.tsx` (FULL READ, lines 1-185) — verified D-067-02 deletion target at line 140 ("Saving response…" fallback), banner switch at 130-150, second banner at 151-166, Resume button at 97-115.
- `frontend/src/components/chat/ToolCallPanel.tsx` (FULL READ, lines 1-728) — verified D-067-03 plumbing: iterationCount declared at line 19-20, consumed at 529-575 (header label only — no per-iteration partition), existing inter-tool separator at lines 640/656 (`h-px bg-border/20`), gradient palette at line 473 (`from-primary to-violet-500`).
- `frontend/src/lib/api.ts` (FULL READ, lines 1-1074) — verified D-067-03 SSE wire at 379-401 (timed_out + iteration_start branches), getMessages mapper at 47-101 (5-value runStatus Literal at line 73), subscribeToRun callback shape at 166-213.
- `frontend/src/types/index.ts` (lines 1-120) — verified Message + ToolCall shapes; runStatus 5-value enum at line 98.
- `backend/app/api/runs.py` (FULL READ, lines 1-497) — verified D-067-04 hot-spots at 76-225 (replay_tail_consumer with try/except RedisError at 168-174 and post-BLOCK at 184-196).
- `backend/app/api/threads.py` (PARTIAL READ — lines 75-200, 1115-1155, 2120-2180) — verified iteration_start emit at line 1133, terminal classification post-066 at 2123-2134, _RUN_STATUS_TO_TERMINAL_TYPE map at 94-99 with timed_out at 98.
- `backend/app/config.py` (PARTIAL READ — lines 71-128, 350-388) — verified MODEL_CAPABILITIES with llm_call_timeout_seconds field, RUN_HARD_TIMEOUT_SECONDS dead-code comment at 362-371, consumer_timeout_seconds=610 at 381.
- `backend/app/api/test_fixtures.py` (FULL READ, lines 1-134) — verified ENABLE_TEST_FIXTURES gate; inject_failed_run is the ONLY route; NO slow_llm_response_seconds fixture exists (confirms CONTEXT.md `<specifics>` paraphrase is inaccurate).
- `backend/venv/Lib/site-packages/redis/exceptions.py` (lines 4, 12) — verified `class TimeoutError(RedisError)` inheritance.
- `backend/venv/Lib/site-packages/redis/asyncio/connection.py` (lines 565-572) — verified `redis-py` 5.3.1 catches `asyncio.TimeoutError` from `async_timeout(read_timeout)` and re-raises as `redis.exceptions.TimeoutError`.
- `backend/venv/Lib/site-packages/redis-5.3.1.dist-info/` — verified redis-py version 5.3.1 installed.
- `frontend/node_modules/vitest@4.1.0` and `frontend/node_modules/@rolldown/binding-win32-x64-msvc/` — verified vitest is functional (`npx vitest --version` returns `vitest/4.1.0`).
- `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md` (FULL READ) — Carry-forward dossier; SC#6 deferred row; Gap-006 closing run `95e3447c-cf9b-448b-9e0d-22c30e40670d` evidence.
- `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md` (FULL READ) — D-066-04..12 lock in.
- `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-05-live-uat-gap-006-regression-PLAN.md` (FULL READ) — verbatim Plan 05 Task 2 protocol for D-067-05 re-run.
- `.planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-CONTEXT.md` (FULL READ) — D-063.1-04..15 patterns Phase 067 layers on top.
- `.planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-04-PLAN.md` (FULL READ) — reconcileInFlightRef + loadMessages MERGE pattern for D-067-01 to extend.
- `.planning/PROJECT.md` (FULL READ) — D-v2.5-08/09/10/11 substrate; CLAUDE.md project rules.
- `.planning/STATE.md` (FULL READ) — Phase 066 closed; Phase 067 queued.

### Secondary (MEDIUM confidence)

- `redis-py` documentation (training data + cross-verified with code at `backend/venv/Lib/site-packages/redis/asyncio/connection.py:565-572`) — TimeoutError as RedisError subclass behavior.
- React 19 useState bail-out optimization behavior (training data + Phase 057 deferral §1 + Phase 060 D-060-11) — "no side-effects in setMessages updaters" rule.

### Tertiary (LOW confidence — flagged for plan-phase confirmation)

- LangSmith MCP / dashboard availability (assumption A2 — was used during Phase 066 UAT, but Phase 067 is a new session).
- backend/.env.example absence of RUN_HARD_TIMEOUT_SECONDS (assumption A3 — couldn't direct-read; verify via grep during plan-phase).

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — every library version verified by direct file read.
- **Architecture (state machine + SSE consumer):** HIGH — every cited line number verified against current code; CONTEXT.md's claimed line numbers (561-589, 544-549, 690, 447) match current state exactly.
- **Pitfalls:** HIGH — derived from explicit comment blocks in the existing code (CR-01 fix at line 411-425, BL-03 at 581-583, WR-03 at lines 333-336, etc.) and from documented prior-phase deferral lessons.
- **Cancellation reclassification (D-067-04):** HIGH — verified `redis.exceptions.TimeoutError` is a `RedisError` subclass; verified the existing `try/except RedisError` ALREADY catches it but logs traceback via `logger.exception`; verified the actual visible-symptom mechanism via `redis/asyncio/connection.py:565-572`.
- **SC#6 protocol:** HIGH — verbatim from Phase 066 Plan 05 Task 2; verified protocol drift in CONTEXT.md `<specifics>` (`slow_llm_response_seconds` is fictional — does NOT exist in codebase per grep).
- **vitest availability:** HIGH (NEW finding) — directly verified via `npx vitest --version` returning `vitest/4.1.0`. Phase 063.1/066 deferred-item carry-forward is RESOLVED.

**Research date:** 2026-05-07
**Valid until:** 2026-05-21 (14 days — display-layer surface; npm/Tailwind/Aether tokens stable; backend Redis-consumer behavior tied to redis-py 5.3.1 release cadence)

## RESEARCH COMPLETE
