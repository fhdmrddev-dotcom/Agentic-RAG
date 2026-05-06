---
phase: 067-frontend-streaming-ux-fix
created: 2026-05-07
parent_phase: 066-adaptive-run-timeouts-lifecycle-states
parent_uat: .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md
status: Ready for planning
---

# Phase 067: Frontend Streaming-UX Fix — Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Restore real-time first-paint of streaming agent events on the chat surface — events emitted by the run-backed Redis Streams architecture (Phases 061–063.1) MUST render progressively as they arrive, with NO requirement to manually refresh the page. Then close the five carry-forward UX issues surfaced by Phase 066's live UAT (UX-067-01..05) and re-run Phase 066's deferred SC#6 protocol so the `timed_out` lifecycle has end-to-end live verification (banner + Resume button + LangSmith clean trace).

After this phase ships, a new chat submission should look and feel like Claude/ChatGPT: optimistic placeholder, progressive token + tool-call rendering, distinct multi-iteration step boundaries, distinct terminal-state banners (cancelled / timed_out / failed), no "Saving response…" thrash, no Redis-consumer log noise on tab cycle, and no need for the user to F5 to see in-flight progress.

**In scope:**
- UX-067-01 — empty first-paint after submit (no manual refresh needed)
- UX-067-02 — `runStatus` state machine sync (no random "Saving response…" mid-stream)
- UX-067-03 — first-paint path standalone (refresh becomes recovery-only, not workaround)
- UX-067-04 — Redis-consumer cancellation cleanup (CancelledError + redis-py-converted TimeoutError no longer log as stack traces on tab refresh)
- UX-067-05 — multi-iteration tool-call boundary visual ("Step N" subtle dividers)
- Phase 066 SC#6 closure — synthetic-timeout protocol re-run (banner + Resume + LangSmith clean trace) — closing UAT of this phase
- Phase 066 D-066-12 stopgap removal — delete obsolete `RUN_HARD_TIMEOUT_SECONDS=600` from `backend/.env` + `backend/.env.example` cosmetics

**Out of scope:**
- New chat features (search across threads, citations export, etc.)
- Backend agent capabilities (`max_iterations`, model registry, tool surface) — locked in Phase 066
- Backend lifecycle states / migrations — locked in Phase 066 (5-value `runs.status`, per-call timer, `stream.close()`)
- Skills Studio scope (next milestone)
- Multi-tenancy / org-level transform (deferred — see SEED-007 / PROJECT.md)
- Phase 064 Validation Harness (separate phase; reproducible MCP scripts for streaming scenarios)
- The F5/refresh recovery path itself — Phase 066 UAT confirmed it works; do NOT regress it (it shares wiring with first-paint)
- New design-system tokens / Aether Intelligence overhaul

</domain>

## Why this phase exists

Phase 066's live UAT (`run_id 95e3447c-cf9b-448b-9e0d-22c30e40670d`, 9m02s, `status='completed'`, `error=NULL`) proved the new run-backed architecture is correct end-to-end at the run-row level: backend emitted SSE events continuously across the entire 542-second multi-iteration window, and LangSmith confirmed clean termination. **However, the frontend did NOT render those events in real-time.** The chat surface stayed empty for an extended period after submission, the user manually refreshed mid-run to see in-flight progress, "Saving response…" thrashed at irrelevant times, and the perceived `execute_code → PNGs → execute_code → PNGs+DOCX` cycle made multi-iteration work feel like a runaway loop.

These five concurrent symptoms were escalated from Phase 066 to Phase 067 as carry-forward (066-HUMAN-UAT.md "Carry-forward to Phase 067" section) so 066 could close on its architectural deliverable without forcing unreliable evidence through a broken display layer. Phase 067 is the display-layer fix that lets the user actually see what the architecture is delivering.

User direction (2026-05-07 — this discuss session):

> "implement what claude ai and ChatGPT do but with considerations to our App architecture, we should not care about the budget but we care about accuracy, performance and failure-free execution" — carried forward from Phase 066 (2026-05-06).

> "you have also access to supabase CLI, chrome MCP, langsmith MCP, you should use them when needed to confirm everything is working 100%" — 2026-05-07.

→ Optimize for completion correctness validated against real running infrastructure (live LLM, live Redis, live Postgres, live LangSmith trace), not just unit/integration tests.

## What "done" looks like

The 6 success criteria in ROADMAP.md for Phase 067, each verified live:

1. Submitting a long-running prompt renders backend events in real-time on the chat surface — no extended empty period, no manual refresh required. Verified in Chrome MCP.
2. `runStatus` state machine is in sync with backend — "Saving response…" never surfaces mid-stream while events still flow. Verified in Chrome MCP across the live Gap-006 prompt.
3. F5 / tab-restore continues to work as designed (Phase 061+ replay-tail) — refresh is a recovery path, not a workaround. Verified in Chrome MCP.
4. SSE client disconnects (tab refresh / close) log at INFO/DEBUG level — no `redis.exceptions.TimeoutError` stack traces from `runs.py` xread paths when a browser tab cycles. Verified in backend logs during a Chrome MCP refresh test.
5. Multi-iteration agent runs surface clear iteration boundaries — user recognizes intended multi-step work rather than perceiving a runaway loop. Verified in Chrome MCP visual inspection of the Gap-006 prompt's multi-`execute_code` run.
6. Phase 066 SC#6 closed: synthetic per-call timeout (`per_call_budget=1` against `slow_llm_response_seconds=2`) renders the "Agent reached time limit" banner, Resume button click re-POSTs the original prompt, LangSmith trace shows clean closure (no `GeneratorExit`). Verified via Chrome MCP + LangSmith MCP. Updates `066-HUMAN-UAT.md` SC#6 row from `deferred` → `green`.

<decisions>
## Implementation Decisions

### First-paint posture (UX-067-01 / UX-067-03)

- **D-067-01:** Architectural cleanup of the streaming-attach lifecycle — NOT a surgical race patch. Pull SSE attach + optimistic placeholder insertion + reconcile-on-mount into one well-ordered, single-source-of-truth state machine in `useMessages.ts`. Researcher attacks the root pattern (overlapping side-effects between `sendMessage`, `reconcile`, and `ChatArea` triggers), not individual race symptoms. Reason: the user's direction is "accuracy, performance, failure-free execution" — surgical patches risk leaving a second race that resurfaces later. Keep the temp-`${run_id}` placeholder + Phase 063.1 D-063.1-12 MERGE-preserve-temp-placeholders pattern (proven by 063.1 UAT) — but ensure the placeholder + first SSE-attach are guaranteed-visible BEFORE any reconcile fetch settles. Specific anti-patterns to avoid (from prior phases' lessons in `057-DEFERRAL.md` and Phase 063.1 plan 03/04 SUMMARY): no side-effects inside `setMessages` updaters; no concurrent `setMessages` writes from different code paths without an explicit guard; preserve Phase 063.1's `reconcileInFlightRef` boolean lock and `guardedSetMessages` thread-match gate verbatim — extend, don't replace.

### Mid-stream UI state semantics (UX-067-02)

- **D-067-02:** Match Claude/ChatGPT — NO extra status indicators while streaming. Delete the `"Saving response…"` fallback at `MessageItem.tsx:140`. Banner copy is reserved for terminal states only:
  - `cancelled` → "Response stopped" (user clicked Stop)
  - `timed_out` → "Agent reached time limit" (Phase 066 D-066-10, unchanged)
  - `failed` → existing failed-state copy
  - `streaming` and `completed` → no banner, no fallback
  The fix layer is to tighten `runStatus` state-machine transitions so the terminal value is set correctly on every code path AND the unguarded terminal flip in `useMessages.ts:561-589` no longer races against the guarded delta callbacks. Concretely: the terminal-flip `setMessages` MUST be subject to the same guarded-by-thread-match invariant as the delta callbacks (today it isn't — see scout finding D.1). No new "persisting" or "thinking" indicator is added.

### Tool-call iteration boundary visual (UX-067-05)

- **D-067-03:** Subtle "Step N" gradient divider between tool-call iterations in `ToolCallPanel.tsx`. The `onIterationStart` SSE callback already fires per iteration boundary (api.ts:394, useMessages.ts:274) and increments `Message.iterationCount`. The plumbing is in; the rendering is missing. Render a thin gradient divider with `Step {iteration_index}` text label, using existing Aether Intelligence visual language (gradient tokens already in use elsewhere in the chat surface). Visual anchor (preview-confirmed by user):
  ```
  ┌─ ToolCallPanel ──────────┐
  │  ⚡ Searching for X      │
  │  📄 Read 3 papers       │
  │ ──── Step 2 ──────────── │
  │  💻 execute_code        │
  │  📊 Generated 3 charts  │
  │ ──── Step 3 ──────────── │
  │  💻 execute_code        │
  │  📄 report.docx         │
  └──────────────────────────┘
  ```
  No collapsible iteration sections, no LLM-generated step summaries — those are deferred (see Deferred Ideas). The first iteration MAY render without an explicit "Step 1" divider above it (clean entry); confirm during implementation.

### Backend Redis-consumer cancellation cleanup (UX-067-04)

- **D-067-04:** At the two `xread` call sites in `backend/app/api/runs.py:163` (live-tail block) and `:184` (post-BLOCK exists probe), wrap the await in an explicit `try / except (asyncio.CancelledError, redis.exceptions.TimeoutError)` and:
  - Log at `INFO` (not `WARNING` / `ERROR`) with a clear message ("consumer disconnected" / "tab cycle") — no stack trace.
  - For `CancelledError`: re-raise (cooperative cancellation, never swallow — preserves Phase 059 D-059-04 invariant).
  - For `TimeoutError` (the redis-py `async_timeout` wrapper conversion): treat as cancellation-equivalent at this call site (the only thing it means here is "consumer's blocking xread was interrupted by client disconnect"). Close the SSE response cleanly. Do NOT propagate as a `503` to the client (the client has already disconnected — no one is listening).
  - Verify: Chrome MCP test that opens a streaming run, refreshes the tab, and inspects backend logs — the `redis.exceptions.TimeoutError` traceback at `runs.py:163` MUST be gone after the fix.
  - Out of scope: changing redis-py's `async_timeout` wrapper behavior, switching to a different Redis client, modifying the live-tail BLOCK timeout. These are library/architecture concerns above this fix's pay grade.

### SC#6 protocol re-run (closing UAT)

- **D-067-05:** Inline SC#6 re-run as the closing UAT of Phase 067 — NOT a separate UAT pass. Once UX-067-01..05 land and Chrome MCP confirms they're live, immediately re-run Phase 066 Plan 05 Task 2 protocol verbatim:
  1. Set `LLM_CALL_TIMEOUT_OVERRIDES=<active-model>=10` in `backend/.env`.
  2. Restart backend.
  3. Submit deliberately-slow prompt against the active model.
  4. Observe in Chrome MCP: "Agent reached time limit" banner renders, Resume button is visible, Resume click re-POSTs the original prompt with full conversation context.
  5. Verify in LangSmith MCP: trace shows clean `TimeoutError` (no `GeneratorExit` exception column at `run_helpers.py:1680`).
  6. Verify in Supabase MCP / CLI: `runs.status='timed_out'`, `runs.error LIKE 'timed_out: %'`, `started_at` and `completed_at` populated.
  7. Update `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md` SC#6 row from `deferred` → `green` with concrete evidence (run_id, timestamps, trace URL).
  Cleanup: revert `LLM_CALL_TIMEOUT_OVERRIDES` to empty string after the test.

### Stopgap removal (housekeeping)

- **D-067-06:** Delete the `RUN_HARD_TIMEOUT_SECONDS=600` line from `backend/.env` and any matching cosmetic refs in `backend/.env.example` / `supabase/SETUP.md` / `REDIS-SETUP.md`. The wrapper consumer was deleted in Phase 066 D-066-01; Pydantic `extra="ignore"` silently drops the env var today, so the line is documentation rot. Folded into 067 as a one-line cleanup task. Plan-phase decides whether to fold into another plan or stand it alone.

### Live-tooling verification rule (phase-wide)

- **D-067-07:** End-to-end live verification is REQUIRED — not optional, not a "nice to have." Every UX fix in this phase MUST be confirmed live before that fix's commit is treated as done:
  - **Chrome MCP** for every visible UI change — placeholder render, real-time delta painting, "Step N" dividers, terminal banner correctness, Resume button visibility, no "Saving response…" thrash. Visual confirmation, not just `tsc --noEmit` green.
  - **Supabase CLI / MCP** for every backend lifecycle assertion — runs-row inspection (`status`, `error`, timestamps), terminal-state correctness, no orphaned `streaming` rows. SQL editor and CLI both acceptable; live DB is authoritative, not test fixtures alone.
  - **LangSmith MCP** for every timeout / cancellation / error path — trace inspection for `GeneratorExit` absence, clean stream closure, expected exception column. Backend log greps are NOT a substitute.
  This rule binds the executor and verifier — the planner should explicitly cite which MCP tool gates which Success Criterion in PLAN.md `<verify>` blocks. Reason: Phase 066's UAT proved test green ≠ user experience green; the architectural fix passed every test but the user couldn't see the agent work. Don't ship that pattern again.

### Claude's Discretion

- Exact divider styling tokens for "Step N" — color, gradient direction, font weight, padding. Pick from existing Aether Intelligence design tokens; if no clean match exists, propose 2-3 variants in plan-phase and pick one. Spawn `/gsd:ui-phase 067` only if the design surface ends up larger than expected (e.g., needs animated entrance, iteration-summary text, mobile-specific treatment).
- Whether the first iteration renders WITHOUT a "Step 1" divider above it (cleanest visual: only render dividers BETWEEN iterations, not above the first). Recommend yes; confirm during plan-phase.
- Where to draw the boundary between the new "single state machine" (D-067-01) and the existing `useMessages.ts` shape — extract to a hook or keep inline. Prefer keep-inline unless the diff exceeds ~150 lines.
- Whether `D-067-06` (stopgap removal) lands in its own commit or is folded into another plan's cleanup. Either is fine; a separate one-line commit is cleanly attributable.
- Banner copy refinements — D-067-02 freezes the high-level rule (terminal-only, no mid-stream chrome). If `failed`-state copy needs polish (e.g., truncating long `runs.error` strings), small wording tweaks are Claude's discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 066 artifacts (parent — carry-forward source)
- `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md` — "Carry-forward to Phase 067" section is the verbatim scope source for UX-067-01..05; SC#6 row is the deferred target. ← **THE primary scope document.**
- `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md` — D-066-04 (5-value `runs.status` enum), D-066-05 (terminal classification map), D-066-06 (SSE terminal sentinel `timed_out`), D-066-10 (banner copy "Agent reached time limit"), D-066-11 (LangSmith clean termination via `stream.close()`). Phase 067 builds on top of these — DO NOT modify them.
- `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-05-live-uat-gap-006-regression-PLAN.md` — Plan 05 Task 2 protocol — the exact procedure to re-run for SC#6 closure (D-067-05).
- `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-05-live-uat-gap-006-regression-SUMMARY.md` — UAT-with-carry-forward pattern documentation; explains why Task 2 was deferred.

### Phase 063.1 artifacts (immediate frontend predecessor)
- `.planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-CONTEXT.md` — D-063.1-04 (runId-match dedup against `messagesRef.current`), D-063.1-09 (`lastSeenOffsetRef` cursor), D-063.1-11 (`reconcileInFlightRef` boolean lock), D-063.1-12 (loadMessages MERGE preserving live `temp-` placeholders), D-063.1-13/14/15 (`runStatus` JOIN through Pydantic `MessageResponse`). Phase 067's first-paint architectural cleanup (D-067-01) layers on top.
- `.planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-04-concurrent-reconcile-loadmessages-merge-PLAN.md` — concurrent-reconcile guard pattern; reuse the `reconcileInFlightRef` shape.

### Phase 063 / 061 artifacts (run-backed architecture foundation)
- `.planning/phases/063-frontend-stream-decoupling/063-CONTEXT.md` — D-063-01 hard cutover (POST returns `{message_id, run_id}` synchronously), Resume button rendering pattern.
- `.planning/phases/061-run-backed-streaming-backend/061-CONTEXT.md` — D-061-09 (4-value status enum, extended to 5 by D-066-04), D-061-12 (terminal sentinel namespace).

### Project-level locks (still in force — DO NOT reopen)
- `CLAUDE.md` — Stack, RLS rule, migration discipline (this phase ships NO migrations — pure frontend + backend log-level fix), single uvicorn worker (D-v2.5-02), `run_in_threadpool` for blocking I/O (D-v2.5-01), Supabase Realtime is best-effort hint (D-v2.5-03), no LangChain / no LangGraph (raw SDK only), Pydantic for structured outputs.
- `.planning/PROJECT.md` Key Decisions — D-v2.5-08 (Redis Streams architecture), D-v2.5-11 (`public.runs` Postgres table), D-v2.5-09 (LLM cost-shift mitigations now finalized in Phase 066).
- `.planning/ROADMAP.md` — Phase 067 entry (lines 393-410) with 6 success criteria.

### Existing code surfaces (the diff lands here)
- `frontend/src/hooks/useMessages.ts` — `sendMessage` (line 447 — first-paint flow), `reconcile` (line 690 — runId-dedup, cursor cache, guarded callbacks), `guardedSetMessages` (line 544-549 — thread-scoped delta gate), terminal-flip block (lines 561-589 — UNGUARDED today; D-067-02 makes guarded), `lastSeenOffsetRef` Map (Phase 063.1 D-063.1-09). **Primary diff target.**
- `frontend/src/components/chat/ChatArea.tsx` — reconcile triggers (mount + visibilitychange + focus + pageshow at lines 163-188 — Phase 063 D-063-04), thread-switch effect (lines 79-127). **Primary diff target.**
- `frontend/src/components/chat/MessageItem.tsx` — banner gating (lines 117-150 — `runStatus`-keyed switch), Resume button (lines 101-112). D-067-02 deletes the line-140 `"Saving response…"` fallback.
- `frontend/src/components/chat/ToolCallPanel.tsx` — accepts `iterationCount` prop today (line 19) but doesn't render iteration boundaries; D-067-03 adds "Step N" divider rendering.
- `frontend/src/lib/api.ts` — `subscribeToRun` parser (lines 265-411), `onIterationStart` callback (line 394), `Message.runStatus` Literal (line 73, 5 values per Phase 066 D-066-04), `getMessages` snake → camel mapper.
- `backend/app/api/runs.py:163, 184` — xread call sites; D-067-04 adds explicit cancellation handling. Off-limits regions: any of D-062-14's carved boundaries (active-runs route surface, Phase 062 plan 03/04 deviations) — confirm in plan-phase.
- `backend/.env` — `RUN_HARD_TIMEOUT_SECONDS=600` line (D-067-06 cleanup).
- `backend/.env.example` — same line removal if present.

### Setup / tooling references
- `supabase/SETUP.md` — local + cloud + migration story (no migrations this phase, but live runs-row inspection per D-067-07).
- `REDIS-SETUP.md` — local + cloud + key conventions; relevant for D-067-04 cancellation behavior verification.
- `backend/.env.example` — env var schema reference.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`onIterationStart` SSE callback** (api.ts:394, useMessages.ts:274) — already fires per iteration_start backend event; already increments `Message.iterationCount`. D-067-03 just renders it. Plumbing is in.
- **`guardedSetMessages` thread-match gate** (useMessages.ts:544-549) — Phase 063.1 D-063.1-08 pattern; thread-scoped delta-update gate. D-067-02 extends it to also gate the terminal-flip `setMessages` (lines 561-589) so the unguarded race surface goes away.
- **`reconcileInFlightRef` boolean lock** (useMessages.ts, Phase 063.1 D-063.1-11) — single in-flight bit; release in `try / finally`. Reuse pattern verbatim if D-067-01's state machine cleanup needs additional in-flight guards.
- **`lastSeenOffsetRef` cursor Map** (useMessages.ts, Phase 063.1 D-063.1-09) — survives reload (`useRef`); reset on hook unmount. Already correct; D-067-01 cleanup must not break it.
- **`temp-${run_id}` placeholder + MERGE-preserve filter** (Phase 063.1 D-063.1-12) — three-clause filter `m.id.startsWith('temp-') && m.runId && !dbRunIds.has(m.runId)`. The first-paint placeholder uses this shape; keep verbatim.
- **`Message.runStatus` 5-value Literal** (api.ts:73) — Phase 066 D-066-04 wired through Pydantic `MessageResponse`. D-067-02's terminal-banner copy + D-067-03's iteration boundary use this same field; no new fields needed.
- **Resume button + `onResume` callback** (MessageItem.tsx:101-112) — Phase 066 D-066-09 gates on `failed || timed_out` already; D-067-05's SC#6 verification just exercises the live path.
- **`_announced_tools` set + tool_preparing emit pattern** (Phase 056.1 D-01) — emits exactly once per tool index; reuse the "exactly-once" discipline for the iteration_start event in D-067-03 if it isn't already.

### Established Patterns
- **Phase 063.1 plan-03 deferred-item carry-forward**: vitest unavailable on this machine (`npm` optional-dep cascade — `@rolldown/binding-win32-x64-msvc` + `@jridgewell/sourcemap-codec` missing). TDD ceremony reduced to `tsc --noEmit` + `grep` gates per Phase 063.1 plans 02/03/04. **Phase 067 inherits this constraint** — runtime test execution may need to defer to CI / fresh `npm install` env. Live verification via Chrome MCP (D-067-07) substitutes for missing vitest.
- **Phase 062 D-062-14 file-layout discipline** — carved off-limits regions in `threads.py`. Phase 067's only backend touch is `runs.py:163, 184` — confirm in plan-phase that those lines are NOT in any carved region.
- **Migration application discipline** (CLAUDE.md) — Phase 067 ships NO migrations. Skip the SQL editor / regen-full-schema dance entirely. If a migration becomes needed, that's a scope creep flag.
- **Live verification standard** (Phase 063 / 063.1 / 066 precedent) — Chrome MCP for visual UI states; Supabase CLI/MCP for runs-row evidence; LangSmith MCP for trace inspection. D-067-07 makes this REQUIRED, not optional.
- **No-side-effects-in-setMessages-updaters rule** (Phase 057 deferral §1, Phase 060 D-060-11) — React Strict Mode double-invokes updaters; bail-out optimizations can skip them. Side effects MUST be outside `setMessages` updaters. D-067-01's state-machine cleanup must respect this.
- **Stateless chat completions** (CLAUDE.md) — store and send chat history yourself; no provider-side thread state. Resume click in D-067-05 re-POSTs the original prompt with full conversation context (Phase 063 `onResume` already does this).

### Integration Points
- **`useMessages.ts` is the single mutator** of the chat-message state. D-067-01's "single state machine" cleanup centralizes here — `sendMessage`, `reconcile`, `subscribeToRun`, `onTerminal` all converge on one well-ordered set of mutations. ChatArea.tsx remains the trigger source (mount/visibilitychange/focus/pageshow listeners) but does NOT mutate state directly.
- **`ToolCallPanel.tsx` consumes `Message.iterationCount` and the tool-calls array** — render iteration boundaries by partitioning the tool-calls array on iteration boundary events; surface a divider with `Step N` label between groups. Existing tool-card rendering stays untouched.
- **`runs.py` consumer pattern** — `replay_tail_consumer` is a generator that owns the SSE response lifetime. D-067-04's cleanup must NOT change the response shape — only the log behavior on cancellation.
- **No new env vars introduced.** D-067-06 removes one (`RUN_HARD_TIMEOUT_SECONDS`); no new configuration surface.
- **No schema changes.** No new migrations. No `full-schema.sql` regen.

### Suggested plan ordering (advisory; gsd-planner finalizes)
1. **067-01 — `useMessages.ts` state-machine cleanup** (D-067-01, D-067-02): unify `sendMessage` / `reconcile` / `onTerminal` mutations behind `guardedSetMessages`; delete `"Saving response…"` fallback at MessageItem.tsx:140; tighten terminal-flip to be guard-aware. Tests: TypeScript build green; Chrome MCP test of submit → real-time deltas → terminal banner.
2. **067-02 — `ToolCallPanel.tsx` "Step N" divider** (D-067-03): render gradient divider between iteration boundaries using existing `iterationCount` field. Tests: TypeScript green; Chrome MCP visual confirmation on multi-iteration prompt.
3. **067-03 — `runs.py` consumer cancellation cleanup** (D-067-04): wrap xread call sites in try/except (CancelledError, TimeoutError); log INFO on disconnect; preserve cooperative cancellation. Tests: integration test exercising disconnect mid-stream + log assertion (no traceback); Chrome MCP refresh test + backend log inspection.
4. **067-04 — Stopgap removal + cleanup** (D-067-06): one-line delete of `RUN_HARD_TIMEOUT_SECONDS` from `backend/.env` + cosmetic refs.
5. **067-05 — Live UAT (Chrome MCP + Supabase + LangSmith)** (D-067-05, D-067-07): re-run Phase 066 Plan 05 Task 2 protocol; update 066-HUMAN-UAT.md SC#6 deferred → green with run_id + trace URL evidence. Closing UAT.

</code_context>

<specifics>
## Specific Ideas

- **Live-tooling stack is non-negotiable** (D-067-07). Chrome DevTools MCP is configured (memory: `feedback_chrome_mcp_testing.md`). Supabase MCP via local CLI + Supabase Studio. LangSmith MCP available. Test login: `fhdmrd@gmail.com` / `123456`. Dev app: `http://localhost:5173/`. Backend: `http://localhost:8000/health`.
- **Visual reference for Step N divider** — gradient horizontal rule with small label, matches Aether Intelligence's existing surface chrome. User-confirmed mockup:
  ```
  │ ──── Step 2 ──────────── │
  ```
- **Backend Phase 066 evidence to compare against**: run_id `95e3447c-cf9b-448b-9e0d-22c30e40670d` (9m02s `completed`, `error=NULL`) — this is the architectural baseline. After 067 ships, the same prompt run live should produce the same backend evidence AND a real-time-painted UI with visible Step boundaries.
- **No stagnant test infra**: Phase 063.1 deferred-item carry-forward means vitest unavailable on this machine. Don't try to make it work in 067 — Chrome MCP is the verification layer. (See 063.1 plan 02/03/04 SUMMARY rationale.)
- **Iteration count source of truth**: backend already emits `iteration_start` SSE events with monotonic counters. Frontend already receives them. ToolCallPanel already accepts `iterationCount`. The miss is purely the rendering layer — keep this small.

</specifics>

<deferred>
## Deferred Ideas

- **Collapsible iteration sections** (`[▾] Step 1 — search & draft`) — heavier visual treatment with collapse/expand affordance. Re-open if Phase 067 UAT surfaces that flat dividers don't help readability on very long runs (e.g., 6+ iterations). Trigger: user feedback "I still can't tell what step I'm on" after 067 ships.
- **LLM-generated step summaries** ("Step 2 — generating charts") — agent-side describes its own iteration intent for the divider label. Larger surface (prompt change + new SSE field). Re-open if subtle "Step N" label proves too generic. Trigger: user asks for richer iteration descriptions.
- **`/gsd:ui-phase 067`** — full UI design contract for the divider + banner + placeholder visual states. Re-open if D-067-03 implementation surfaces design ambiguity beyond Claude's discretion (mobile treatment, animation tokens, dark/light parity). Trigger: D-067-03 plan-phase finds no clean Aether match for the gradient style.
- **Iteration-boundary collapse-on-completion** — auto-collapse completed iterations to keep the panel compact. Re-open if long runs become unreadable scroll surfaces. Trigger: 6+ iteration runs become routine.
- **Backend SSE emission audit** — confirm every state transition in `agent_runner` emits an SSE event before the next state begins. Today's gap: subtle `runStatus` transitions may not be observable from the consumer side. Re-open if D-067-02's tightening surfaces a backend-emission gap (e.g., `streaming → completed` without an explicit terminal). Trigger: live UAT shows banner-flicker that traces back to missing backend events.
- **Persistent-state indicator** ("Saving…" between SSE-end and Postgres persist) — D-067-02 chose match-Claude-and-don't-show-it. Re-open if users report confusion when the assistant message appears to vanish briefly between stream-end and DB persistence. Trigger: post-067 UAT report of "the message disappeared for a second."
- **Tool-call surfacing for Explorer mode** — Explorer mode has a different tool surface (6 KB tools) and `max_iterations=8`. D-067-03's "Step N" divider applies to General mode by default; verify it works for Explorer too in plan-phase. If Explorer's UI differs enough to need a separate treatment, defer to a follow-up.

### Reviewed Todos (not folded)
None — no pending todos matched this phase's scope at discuss time.

</deferred>

---

*Phase: 067-frontend-streaming-ux-fix*
*Context gathered: 2026-05-07; decisions locked: 2026-05-07*
