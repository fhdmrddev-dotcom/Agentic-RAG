# Phase 092: Dual-Mode Wiring + Continue Button - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase **wires the Phase 091 harness engine into the live app** and adds the SEED-029 Continue
affordance. A thread can switch between **Deep Mode** (today's free chat — the unchanged default) and
**Harness Mode** (a locked, ordered workflow the LLM cannot escape). The lock is **per-thread and
server-enforced**, Cancel cleanly exits, and hitting a step cap surfaces a **Continue** button instead of
silently dropping tool calls.

In scope (Requirements: MODE-01, MODE-02, CONT-01):
- **Mode wiring** — `agent_runner`/producer branches on `threads.active_workflow_run_id` (NULL = Deep →
  `run_agent_loop`; non-null = Harness → `harness_engine.run_workflow`). A mode switch takes effect only
  on the NEXT run, never mutating an in-flight stream.
- **Workflow run creation** — the net-new `INSERT INTO workflow_runs` + atomic
  `UPDATE threads SET active_workflow_run_id` that 092 OWNS (none exists in `backend/app` today). Persists
  `workflow_runs.inputs` + `model` at creation — **this closes SEED-047** (resume-ctx rehydration).
- **Per-thread workflow lock** — Harness→Deep refused **server-side at run creation** until the run reaches
  a terminal status or the user Cancels; lock state is per-thread keyed (Map/Set, never a global boolean).
- **Cancel** — reuse the existing Stop button / `DELETE /runs/{run_id}`; the cancel additionally clears
  `active_workflow_run_id` in the SAME transaction as the terminal-status write (no dangling lock).
- **Continue affordance (CONT-01 / SEED-029)** — when a run hits its step cap (a Deep run OR a Harness
  phase), a Continue button resumes the SAME run/phase with a bounded extra budget, consuming the
  previously-dropped tool calls (re-reading `workflow_phases.available_tools` from Postgres for a Harness
  phase). Capped at 3 Continues per run.
- **State reconciliation endpoint** — `GET /threads/{id}/workflow` so the panel reconciles true mode/lock
  state on mount (D-v2.5-03), never trusting a Realtime/SSE hint alone.
- **UI** — Deep/Harness toggle + published-workflow picker in the composer toolbar; General/Explorer
  selector disabled+tooltip while a workflow is locked; Continue button inline in chat (extends the 075.4
  system-message carrier).

Out of scope (later phases): the live panel **phase timeline** rendering (094 — events ride the existing
`run:{run_id}` stream; 092 only emits/reconciles), chat tool-card unification (095), Anthropic parity
(093), eval CI gate + restart-mid-workflow verification + `llm_batch_agents` fair-share (096). The harness
engine itself (091) is DONE — 092 only branches to it and creates its runs.

**Hard constraint (075.x cascade prevention, carried from 091):** the mode branch lives ABOVE the agent
loop at the producer/run-creation site — NEVER in provider-specific streaming branches. Deep Mode stays
byte-identical (the 091 whitelist guard is already a literal no-op when `active_workflow_run_id IS NULL`).
The per-thread lock follows the BUG-260523-01 fix pattern already proven in StreamsProvider.
</domain>

<decisions>
## Implementation Decisions

### Entering Harness Mode + selecting a workflow (MODE-01)
- **D-01:** **Toggle + workflow picker.** A Deep/Harness toggle sits near the existing agent-mode
  (General/Explorer) selector in the composer toolbar; choosing Harness reveals a dropdown of **published**
  workflows (`workflow_definitions WHERE is_global / published`). Mirrors the existing selector pattern the
  user already knows; keeps "what mode am I in" explicit; gives the picker a natural home.
- **D-02:** **The next chat message is the workflow input/kickoff.** User picks the workflow, types their
  prompt, and hitting send starts the run with that prompt as the workflow input. Matches SC#1 ("mode
  switch takes effect only on the NEXT run, never mutates an in-flight stream"), feels like normal chat,
  and naturally persists `workflow_runs.inputs` + `model` at creation (closes SEED-047). **No** dedicated
  inputs form in v1; **no** auto-start-on-selection (seed templates like literature-review need a topic).

### General/Explorer selector during an active workflow (MODE-01 UX-composition)
- **D-03:** **Disabled + tooltip.** While a workflow is locked and running, the General/Explorer selector
  stays visible but greyed/disabled with a tooltip ("Controlled by the active workflow"). The phase
  whitelist is authoritative mid-run, so the selector is moot — disabling (not hiding) avoids a layout
  jump, signals the control still exists, and re-enables when the run ends. (Roadmap explicitly flagged
  this as the discuss-phase call; resolved as the least-confusing affordance.)

### Workflow lock + Cancel (MODE-02)
- **D-04:** **Reuse the existing Stop button** (`DELETE /runs/{run_id}`) to cancel a running workflow — one
  familiar control, no new stop-like affordance. The backend cancel path additionally clears
  `threads.active_workflow_run_id` in the SAME transaction as the terminal-status write (SC#2), unlocking
  the thread back to Deep with no dangling lock.
- **D-05:** **Lock feedback = disabled toggle + tooltip.** While the thread is workflow-locked, the
  Deep/Harness toggle is greyed with a tooltip ("Workflow running — Cancel to switch back"). The
  client-side disable prevents the doomed action up front; the **server-side refusal at run creation
  (SC#2) remains the authoritative backstop** — the grayed button is a UX courtesy, not the enforcement.
  Consistent with D-03's disable-with-tooltip pattern.

### Continue affordance (CONT-01 / SEED-029)
- **D-06:** **Cap at 3 Continues per run.** Each Continue grants a fresh bounded step budget; after 3 the
  run stops with a clear message. SEED-029 §4's recommendation — a safety valve against runaway loops /
  cost while still covering legitimate long multi-step tasks. Track `continues_used` per run (telemetry +
  enforcement). Applies to BOTH a Deep run and a Harness phase.
- **D-07:** **Continue lives inline in chat**, by extending the existing **075.4 iteration-cap
  system-message carrier** (`kind: iteration_cap_paused`) into an actionable card with a Continue button —
  shown right where the run paused, for both Deep and Harness runs. Least new UI surface (SEED-029 §3
  path); avoids coupling 092 to the unbuilt Phase 094 panel timeline.
- **D-08 (locked by SC#4 — confirmed, not re-litigated):** Continue **consumes the previously-dropped tool
  calls** (does NOT re-drop them, does NOT start fresh), resuming the SAME run/phase. For a Harness phase
  it re-reads `workflow_phases.available_tools` from Postgres before resuming. It never blindly bumps a
  global cap unbounded — the bounded extra budget is the unit of resumption.

### Claude's Discretion
- Exact toggle/picker component shape and placement within the composer toolbar (follow the existing
  agent-mode selector idiom).
- Whether Continue reuses the existing Resume path (`POST .../resume` with a `reset/continue` flag) or a
  new `POST .../continue` endpoint — SEED-029 §2 prefers reuse; planner/researcher decides against the
  actual Phase 091 resumability surface and the run lifecycle.
- New run-lifecycle status value(s) for the cap-paused state (SEED-029 §1 suggested `iteration_cap_paused`;
  reconcile against the Phase 066 status enum and the 091 workflow_runs statuses).
- Exact tooltip/message copy for D-03 / D-05 / the "3 Continues used" stop message.
- `GET /threads/{id}/workflow` response shape (must carry enough for the panel to reconcile mode + lock +
  current phase + terminal/absent-run detection per SC#5).

### Folded Todos
None — todo list empty per STATE.md (no pending todos matched this phase).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & success criteria (locked — the binding acceptance bar)
- `.planning/REQUIREMENTS.md` lines 33–35 — MODE-01, MODE-02, CONT-01 verbatim.
- `.planning/ROADMAP.md` § "Phase 092" — the 5 success criteria + the General/Explorer-selector discuss
  note.

### The Continue affordance design (authoritative for CONT-01)
- `.planning/seeds/SEED-029-iteration-cap-continue-button.md` — the full Continue design: §1 lifecycle
  state, §2 resume-vs-continue API surface (reuse preferred), §3 UI carrier (075.4 system-message), §4 cap
  policy (3/run recommended — D-06), §5 telemetry (`continues_used`), and the dropped-tool-calls open
  question (resolved by SC#4 / D-08).

### The engine + run-creation substrate 092 wires into (READ — 092 owns the missing INSERT)
- `backend/app/services/harness_engine.py` — `run_workflow()`; the Harness branch target. 092 creates the
  `workflow_runs` row + sets `active_workflow_run_id`, then the producer drives `run_workflow`.
- `backend/app/db/workflows.py` — existing reads (`find_resumable_runs` at ~line 96 reads
  `active_workflow_run_id`); the natural home for the net-new `create_workflow_run` helper (asyncpg, mirror
  `backend/app/db/runs.py`).
- `.planning/phases/091-harness-engine-5-phase-types-gates-whitelist/091-CONTEXT.md` +
  `.planning/STATE.md` "SEED-047" deferral — 092 MUST persist `workflow_runs.inputs` + `model` so resumed
  `programmatic`/`llm_*` phases rehydrate (Phase 096 EVAL-02 is the proof gate).
- `supabase/full-schema.sql` — `workflow_runs` (~line 739), `threads.active_workflow_run_id` (~line 634,
  FK `ON DELETE SET NULL`, partial index at ~1218).

### The clean substrate + branch site (Phase 089 — READ before touching the run path)
- `backend/app/api/threads.py` — the `send_message` route, producer/`_spawn` (~line 99), the
  `run_agent_loop` call site (~line 1049 — the mode branch goes ABOVE it), and `_shielded_finalize`
  (~1122–1246, STAYS regardless of mode). Also the `get_tools()` composition site (091 D-05 filter).
- `backend/app/services/agent_loop.py` — `run_agent_loop()`; Deep=8 / Explorer=15 `max_iterations`,
  `force_no_tools = (iteration == max_iterations - 1)` at the cap (the silent-drop point the Continue
  affordance addresses).
- `backend/app/api/runs.py` — `DELETE /runs/{run_id}` cancel (happy path ~678, zombie-heal ~701); the
  cancel path 092 extends to clear `active_workflow_run_id` in the terminal-status transaction (D-04/SC#2).

### Frontend surfaces (READ — reuse the proven patterns)
- `frontend/src/components/chat/MessageInput.tsx` (~lines 31–32, 132–250) — the existing
  `agentMode: "default" | "explorer"` selector; the Deep/Harness toggle + workflow picker live alongside
  it (D-01); the disable-while-locked treatment lands here (D-03/D-05).
- `frontend/src/providers/StreamsProvider.tsx` (~lines 709–754) + `frontend/src/hooks/useMessages.ts`
  (~lines 18–20, 86) — the **per-thread keyed Map/Set** streaming-state pattern (BUG-260523-01 fix); the
  per-thread lock state MUST follow this shape, never a global boolean (SC#3).
- `frontend/src/lib/api.ts` — existing `cancelRun` etc.; the `GET /threads/{id}/workflow` reconcile client
  + the Continue trigger client land here.
- The 075.4 iteration-cap system-message carrier (`kind`-tagged system-role message renderer) — the D-07
  Continue button host.

### Process (project conventions — MANDATORY)
- `CLAUDE.md` § Rules — raw SDK (no LangChain/LangGraph), Pydantic structured outputs, RLS on all tables,
  `run_in_threadpool` for blocking supabase-py (D-v2.5-01), **Realtime is a hint not truth — reconcile via
  fetch on (re)connect (D-v2.5-03)** (directly drives SC#5 / `GET /threads/{id}/workflow`), multi-worker
  default (WORKER_COUNT=2 — per-thread keyed state, no global singletons).
- `CLAUDE.md` § UAT scoreboard recipe — **SC#10 4-axis UAT is a phase gate** (cross-provider × multi-tool ×
  parallel-thread × long-message); **native-7** is the real bar (D-089-05: +zhipu/GLM, +minimax),
  OpenRouter best-effort. SC#3's parallel-thread axis (Thread A streaming a workflow does NOT lock Thread
  B's toggle/composer) is the lived-experience gate for the per-thread lock. This phase ALSO unblocks
  091's persisted cross-provider UAT (091 had no `INSERT INTO workflow_runs` to trigger a workflow).
- `CLAUDE.md` § Workflow guardrails — G-2 was NOT flagged for 092 by the roadmap (only 094/095). 092's UI
  reuses existing patterns (agent-mode selector, Stop button, 075.4 carrier). If the workflow-start UX
  grows beyond a toggle+dropdown during planning, escalate to `/gsd:sketch` before building.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (092 is wiring — REUSE, do not reinvent)
- **`harness_engine.run_workflow`** (091) — the Harness branch target; already built and verified.
- **`threads.py` producer/`_spawn` + `run_agent_loop` call site (~1049)** — the single place the mode
  branch goes (ABOVE the loop). `_shielded_finalize` stays mode-agnostic.
- **`DELETE /runs/{run_id}`** (`runs.py` ~623) — the existing cancel; extend its terminal-status txn to
  clear `active_workflow_run_id` (D-04).
- **075.4 iteration-cap system-message carrier** — the Continue-button host (D-07); already ships the
  `kind`-tagged passive warning, becomes actionable.
- **Per-thread keyed Map/Set state** in StreamsProvider/useMessages (BUG-260523-01 fix) — the template for
  the per-thread lock (SC#3); `useStreamingForThread(viewedThreadId)` is the selector idiom.
- **`MessageInput.tsx` agent-mode selector** — the placement + idiom for the Deep/Harness toggle + picker.
- **`workflow_phases.available_tools`** (090/091) — re-read from Postgres on Continue for a Harness phase
  (D-08).

### Established Patterns
- Raw SDK, Pydantic structured outputs, RLS everywhere, `run_in_threadpool` for blocking I/O,
  Realtime-as-hint-reconcile-on-fetch (D-v2.5-03 → `GET /threads/{id}/workflow`), per-thread keyed state
  (no global singletons; WORKER_COUNT=2).
- One UX, N adapters — the mode branch + lock are provider-agnostic at the producer/run-creation site;
  zero provider-branch edits (Deep Mode byte-identical, the 075.x cascade rule).

### Integration Points
- `threads.active_workflow_run_id` — the dual-mode anchor. 092 writes it (on workflow start) and clears it
  (on cancel/terminal); the producer reads it to branch. The 091 whitelist guard already no-ops when NULL.
- `GET /threads/{id}/workflow` (net-new) — the panel's mount-time reconcile source (SC#5); also the
  client's source of truth for whether to show locked/Continue affordances.
- `workflow_runs` INSERT (net-new, 092-owned) — must carry `inputs` + `model` (SEED-047) and set the
  thread's `active_workflow_run_id` atomically before the producer spawns.

### Critical-risk surfaces (verification must target these)
- **Per-thread lock must NOT be a global boolean** (SC#3 / BUG-260523-01) — the most likely regression;
  parallel-thread UAT (Thread A workflow streaming, Thread B toggle/composer free) is the gate.
- **No dangling lock** (SC#2) — cancel/terminal MUST clear `active_workflow_run_id` in the SAME
  transaction; a thread stuck Harness-locked with a terminal/absent run is the failure mode (SC#5 reconcile
  is the heal).
- **Deep Mode byte-identical** — the mode branch is purely additive at the producer; a Deep run with
  `active_workflow_run_id IS NULL` must behave exactly as today (no SSE/iteration-cap change except the
  Continue carrier becoming actionable, which is additive).
- **Continue must consume, not re-drop** the buffered tool calls (SC#4 / D-08) — the whole point of the
  affordance vs the 075.4 passive warning.
</code_context>

<specifics>
## Specific Ideas

- "Workflows should feel like normal chat to start" — the user accepted the recommendation that picking a
  workflow + typing the next message kicks it off (D-02), rather than a separate inputs form.
- "Least-confusing affordance" — the user consistently chose **disable + tooltip** over hide-or-mislead
  for both the General/Explorer selector mid-run (D-03) and the locked mode toggle (D-05); honesty about
  why a control is inert beats making it vanish or letting it fail.
- "Reuse what's already there" — Stop button for cancel (D-04), the 075.4 carrier for Continue (D-07), the
  existing selector idiom for the toggle (D-01); 092 is wiring, not new surface.
- SEED-029 lineage: Continue is the *capability* fix to the milestone-wide "nothing silently dropped"
  principle (the 075.4 warning closed the trust gap; this closes the capability gap), capped at 3/run as a
  runaway-loop safety valve.
</specifics>

<deferred>
## Deferred Ideas

- **Dedicated structured inputs form per workflow** — only if a future workflow needs typed multi-field
  inputs beyond a single kickoff prompt (D-02 rejected it for v1; no seed template needs it).
- **Continue surfaced in the panel timeline** — the panel is Phase 094's surface; 092 keeps Continue inline
  in chat (D-07). Revisit when 094 lands if a panel-side Continue adds value.
- **Per-user / per-org Continue quota** — SEED-029 §4 ties caps to multi-tenancy (v3.0+); v1 is a flat
  3/run (D-06).
- **Continue telemetry dashboard** ("are we setting max_iterations too low?") — SEED-029 §5; 092 tracks
  `continues_used` per run, but the aggregate dashboard is a later analytics concern.
- **Restart-mid-workflow independent kill-and-resume verification** — Phase 096 (EVAL-02). SEED-047's
  rehydration (which 092 closes by persisting `inputs`+`model`) is *proven* there, not in 092.

### Reported-bugs cross-check (discuss-phase touchpoint — MANDATORY)
4 open `surface: Agentic-RAG` bugs exist; NONE overlap Phase 092's domain (dual-mode backend wiring + mode
toggle + Continue/Cancel) — all are chat-surface/provider-parity defects already routed:
- `non-anthropic-generic-code-task-descriptions` → PARITY-01 / **Phase 093**
- `chat-tool-cards-scroll-collapse-duplicate`, `step-count-mismatch-timer-vs-panel`,
  `timer-disappears-long-runs` → CHAT-04 / **Phase 095**
No folding into 092. Left open, owned by their routed phases. (Note: 092's Continue button extends the
075.4 system-message carrier — keep that change additive so it doesn't collide with the Phase 095
chat-card unification surface.)

### Reviewed Todos (not folded)
None — todo list empty per STATE.md.
</deferred>

---

*Phase: 092-dual-mode-wiring-continue-button*
*Context gathered: 2026-05-31*
</content>
</invoke>
