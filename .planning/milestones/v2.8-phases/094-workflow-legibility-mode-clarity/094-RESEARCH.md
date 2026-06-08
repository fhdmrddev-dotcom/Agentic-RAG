# Phase 094: Workflow Legibility + Mode Clarity - Research

**Researched:** 2026-06-04
**Domain:** Frontend SSE wiring + panel rendering (React/Zustand/Tailwind) + ONE surgical backend persist fix (FastAPI/asyncpg)
**Confidence:** HIGH — every CONTEXT/DATA-CONTRACT anchor was re-verified against the live code this session; drift noted inline.

> **This is an integration-map research, not a discovery research.** The phase is DESIGN-LOCKED (094-UI-SPEC.md 6/6 dimensions approved, sketches 008–013 locked). No new libraries, no new patterns to discover. The job: map the locked contract to the ACTUAL current code with verified line anchors, falsifiable invariants, and the landmines specific to this surface. The planner consumes this to write grep-verifiable tasks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-07, verbatim authority)

- **D-01 — Deep tool-cards STAY in chat (D-094-UNIFY NARROWED).** Do NOT relocate Deep's RunCard/ToolCallPanel out of chat. Panel shows mode-appropriate content: **Harness → new live phase-timeline**; **Deep → existing v2.7 sections (todos/files/pending/versions)**. This DROPS all G-5 hot-file risk (ToolCallPanel/MessageItem/StreamsProvider chat-bucket path untouched) and dissolves the 094↔095 collision. The 3 chat-card bugs (scroll/collapse/duplicate, timer-disappears, step-count-mismatch) ALL stay in Phase 095 — 094 folds in NONE of them.
- **D-02 — Mode label from server truth (small/surgical).** Derive the displayed mode label from `threads.active_workflow_run_id` (already in the store as `workflowLock` presence), NOT the stale `ChatArea` `useState<"deep"|"harness">`. Kills finding #5. The Phase-092 composer (Deep/Harness toggle + workflow picker) stays AS-IS. The 2-pill redesign + Workflows page + `GET /workflows/{id}` defer to v2.9/SEED-051.
- **D-03 — Producer-honest subset only; SUPPRESS (don't fake) the rest.** Render: agent count (client tally of `sub_agent_start`), phase transitions (split→review→merge), merge narration, per-subtopic `sub_agent_done.summary`, draft before `ask_user`, failure-with-reason. SUPPRESS per-phase tool/search counts (they fire on `run:{sub_run_id}` — invisible to the producer). Build-Prereq B → SEED-053.
- **D-04 — RC-4 backend source fix LANDS in 094 (the ONE backend touch, required).** The harness failure path emits `run_failed` and returns WITHOUT persisting a message → later reconcile reads a terminal run with empty content → renders as silent `done`. Fix: persist a real failure message before returning, INSIDE `run_workflow`, NOT in shared `_shielded_finalize` (Deep stays byte-identical). UI-only is INSUFFICIENT.
- **D-05 — `--accent-violet` token migration — REQUIRED, FIRST.** Add to BOTH theme blocks in `frontend/src/index.css` (HSL channels, no `hsl()` wrapper, verification comment) AND register in `frontend/tailwind.config.js`, BEFORE any purple surface (`retrying` state / `llm_batch_agents` marker) renders. Frontend CSS change, NOT a SQL migration.
- **D-06 — Intermediate output is PURE FRONTEND.** Draft (`ask_user_prompt.draft`) already on the wire + `PendingAskCard` already receives `ask.draft` but doesn't render it. Batch summaries (`sub_agent_done.summary`) already in `tasksByThread`. Add: draft preview (+ open-wide overlay) in `PendingAskCard` + per-subtopic summary display. ZERO backend changes.
- **D-07 — Additive-only SSE (binding).** New `phase_*`/`gate_failed`/`run_failed` handlers are additive `else-if` branches AFTER the Deep dispatch in `frontend/src/lib/api.ts`. The existing `delta`/`sources`/`citations`/`confidence`/tool dispatch stays BYTE-IDENTICAL. New state in a panel-only `phasesByThread` slice; chat selectors never read it → a panel mutation triggers ZERO chat re-renders.

### Claude's Discretion

None flagged. The UI-SPEC + locked sketches define the visual/interaction contract. Component file layout + hook shape are the planner/executor's standard choices.

### Deferred Ideas (OUT OF SCOPE — note only, NEVER research as build work)

- Deep tool-card relocation into the panel (DROPPED, D-01).
- The 3 chat-card bugs (scroll/collapse/duplicate, timer-disappears, step-count-mismatch) → **Phase 095**.
- Composer 2-pill redesign + Workflows PAGE + `GET /workflows/{id}` (Build-Prereq C) → **v2.9 / SEED-051**.
- Build-Prereq B sub-stream tool counts threaded to producer (per-phase "N searches / N tool calls") → **SEED-053**.
- Interactive todo-driven execution + HITL loop → **SEED-052 / BUG-260604-01**.
- Generated-files-in-panel (`execute_code` artifacts not threaded to producer) → **SEED-037/038**. Confirm coverage at planning; do NOT promise in 094 (FILES tab absence is NORMAL).
- Ops graceful-shutdown drain (093 finding #7) — backend/ops, not a 094 render concern.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (from REQUIREMENTS.md) | Research Support |
|----|-------------|------------------|
| **PANEL-08** | Workspace panel shows a live phase timeline (current/locked/completed glyphs, gate pass/fail badges, transition log) that auto-opens on entering Harness Mode and reconciles via fetch on mount. | New `PhaseTimeline`+`PhaseCard` section in `WorkspacePanel.tsx` body (after the Versions section), mounts when `mode==='harness' OR phases exist`; reconciled by `GET /threads/{id}/workflow` (confirmed at `threads.py:1592`, carries `total_phases`/`current_phase_index`/`current_phase_slug`/`mode`/`definition_name`/`run_status`/`latest_producer_run_id`). Status states keyed off verified wire events (`phase_started`/`phase_completed`/`gate_failed`/`run_failed`/`phase_transition`). |
| **PANEL-09** | Phase events ride `run:{run_id}` stream, demux into a dedicated `phasesByThread` store; panel phase updates trigger ZERO chat message-list re-renders (PANEL-06 isolation). | `phasesByThread: Map<threadId, Phase[]>` slice beside `workflowLockByThread` (`streamsStore.ts:135`); demux via new `onPhase*` callbacks in `makeStreamCallbacks` (`StreamsProvider.tsx:687-720` region); new `usePhases` selector. Isolation is **structurally enforced**: `useThreadMessages` (`StreamsProvider.tsx:1978`) reads `bucketsBySurface` EXCLUSIVELY — a Zustand selector only re-renders on its selected slice. Provable via the existing FC#1 pattern (`panelHooks.test.tsx:292-310`: `expect(bucketsBySurface).toBe(before)`). |
| **A11Y-03** | Phase timeline meets WCAG 2.1 AA — keyboard nav, ARIA landmarks/labels, non-color-only status, ≥4.5:1 both themes (vitest-axe gated). | `vitest-axe@0.1.0` already installed + wired in `setupTests.ts:6-8` (`toHaveNoViolations` global). UI-SPEC §A11Y contract pre-specifies every ARIA role (section/ol/li APG accordion, role=status announcer, role=progressbar indeterminate, aria-busy flip, icon-only aria-label) + verified contrast tokens. |

(+ D-092-UX subset that lands in 094 = **mode-label-from-server-truth only**, D-02. + the audit RC-4 failure-honesty, D-04. + intermediate-output rendering, D-06.)
</phase_requirements>

## Summary

Phase 094 is a **wiring + rendering** phase with a single ~30-line backend touch. The harness engine ALREADY emits the full producer event vocabulary (`phase_started`/`phase_completed`/`phase_transition`/`gate_failed`/`run_failed`/`run_completed`/`sub_agent_*`) on the `run:{run_id}` Redis stream — **but `frontend/src/lib/api.ts` has NO branch for any `phase_*`/`gate_failed`/`run_failed`/`run_completed` event** (verified: zero matches anywhere in `frontend/src`). The events are wire-emitted and silently dropped. 094 adds the missing `else-if` branches (additive, after the Deep dispatch), a panel-only `phasesByThread` store slice (mirroring the proven `tasksByThread`/`todosByThread` shape), a new `PhaseTimeline`+`PhaseCard` section in the existing `WorkspacePanel`, plus three pure-frontend renders already supplied by data on the wire (mode label, draft preview, batch summaries).

The **one backend touch** (D-04 / RC-4) is precise: `harness_engine.run_workflow` has **TWO** failure-return sites (`fail_run` at ~699–709 and the `skip_to_phase` runtime-guard at ~712–735) that emit `run_failed` and `return` WITHOUT persisting any `messages` row — while the success path (line 822) calls `_surface_final_answer` which DOES persist. The fix is a new `_surface_failure_message` helper that mirrors the persist block of `_surface_final_answer` (lazy-import `insert_assistant_message` from `app.db.runs`) and is called at both failure sites before `return`, INSIDE `run_workflow`. It must NOT go in `_shielded_finalize` (the shared Deep+harness path — Deep byte-identical guard).

The hard part is not the wiring (mechanical, well-precedented) — it is **discipline**: (1) keeping the Deep dispatch in `api.ts` byte-identical, (2) keeping `phasesByThread` panel-only so chat never re-renders (PANEL-09), (3) SUPPRESSING the invented counts that fire on the invisible sub-stream, and (4) the `--accent-violet`-before-token-migration broken-CSS trap. The validation strategy leverages an EXISTING gold-standard test pattern (`panelHooks.test.tsx`) that replays raw SSE bytes through the REAL `subscribeToRun` normalizer into the store, and the FC#1 reference-identity assertion that proves the zero-chat-re-render invariant.

**Primary recommendation:** Sequence as the CONTEXT dictates — **D-05 token FIRST** (gates every purple surface), then the SSE branches + `phasesByThread` slice (PANEL-09 substrate), then the `PhaseTimeline` section (PANEL-08), then D-02/D-06 pure-frontend renders, then the D-04 backend RC-4 fix (independent, can parallelize). All five validation invariants map to vitest unit/integration tests that already have a working precedent in the repo; the cross-provider + parallel-thread + both-themes axes stay manual (Chrome MCP) in VALIDATION.md per SC#10.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Phase event normalization (SSE → state) | Frontend (api.ts `subscribeToRun`) | — | The ONE SSE consumer; new `phase_*` branches attach here (D-07). The events already exist on the wire (backend done). |
| Phase state storage (panel-only) | Frontend (Zustand `phasesByThread`) | — | Panel-only slice; chat selectors must never read it (PANEL-09). Backend has no per-thread phase store — it's a client projection of the event stream + reconcile. |
| Phase timeline render | Frontend (`PhaseTimeline`/`PhaseCard` in panel) | — | Pure presentation over `usePhases` + `useTasks` + reconcile. |
| Reconcile-on-mount (the floor) | Frontend (`getThreadWorkflow`) ← Backend (`GET /threads/{id}/workflow`) | Backend reconcile endpoint | Endpoint EXISTS (`threads.py:1592`), returns everything the timeline needs to seed. Frontend calls it; live advances forward. |
| Mode label (server truth) | Frontend (`ChatArea` derives from `workflowLock`) | Backend (`active_workflow_run_id` via reconcile) | The truth lives in `threads.active_workflow_run_id`; the frontend already reconciles it into `workflowLock`. D-02 = read THAT, not local `useState`. |
| Failure-message persistence (RC-4) | **Backend** (`harness_engine.run_workflow`) | Frontend renders failed-with-reason off `run_failed`/`gate_failed` | This is the ONLY tier 094 writes new backend code in. The durable `messages` row must exist for the reconcile to read; UI-only can't fix it. |
| Draft + batch-summary render (D-06) | Frontend (`PendingAskCard` + a batch-summary view) | — | Data already on the wire + in the store; zero backend. |
| `--accent-violet` token (D-05) | Frontend (CSS/Tailwind) | — | Pure design token; gates purple surfaces. |

## Standard Stack

No new dependencies. 094 composes the EXISTING stack (verified in `frontend/package.json`).

### Core
| Library | Version (verified) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.x (existing) | Components | App standard. |
| zustand | (existing, `subscribeWithSelector`) | `phasesByThread` store slice | The streams store is already Zustand v5 with per-thread Maps; the new slice mirrors `tasksByThread` exactly. [VERIFIED: streamsStore.ts:36-37] |
| tailwindcss | (existing) | `--accent-violet` utility | Token registered in `tailwind.config.js` mirroring `panel-status-*`. [VERIFIED: tailwind.config.js:53-54] |
| lucide-react | (existing) | Phase/status glyphs | UI-SPEC: lucide where a clean match exists; status atoms use text glyphs (`✓ ● ○ ✕ ↻`) in `aria-hidden` circles + real text label. |
| @radix-ui via shadcn/ui | (existing) | `Collapsible` (phase accordion), `Dialog` (wide-draft overlay), `Tooltip` | UI-SPEC Registry Safety: all blocks already installed; this phase composes, does not `add`. |

### Supporting (test stack — for the Validation Architecture)
| Library | Version (verified) | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.0 | Unit/integration runner | `npm run test` (= `vitest run`). [VERIFIED: package.json] |
| @testing-library/react | 16.3.2 | `renderHook`/`render`/`act` | Hook + component tests. |
| vitest-axe | 0.1.0 | WCAG `toHaveNoViolations` | A11Y-03 gate. Already wired in `setupTests.ts:6-8`. [VERIFIED] |
| jsdom | 29.0.0 | DOM env | vitest environment. |

**Installation:** none. `npm view` is N/A — no registry adds; all deps confirmed present in `frontend/package.json`.

## Architecture Patterns

### System Architecture Diagram

```
                          BACKEND (already emits; 094 adds ONLY the D-04 persist)
                          ┌─────────────────────────────────────────────────────┐
   harness_engine         │  run_workflow loop:                                  │
   .run_workflow ─────────┤   phase_started → _run_phase_with_gates →            │
                          │     ├─ gate_failed{phase,attempt,error}  (retry/term)│
                          │     ├─ phase_completed → phase_transition            │
                          │     ├─ fail_run  → run_failed + RETURN  ◄── D-04 FIX │
                          │     ├─ skip_to (guard) → run_failed + RETURN ◄─D-04  │
                          │     └─ success → _surface_final_answer (PERSISTS) →  │
                          │                  run_completed                       │
                          │   sub_agent_start/done{summary} (PRODUCER stream)    │
                          └───────────────┬─────────────────────────────────────┘
                                          │  XADD run:{run_id}  (Redis Stream)
                                          ▼
   GET /threads/{id}/workflow   ┌──────────────────────────────────────────────┐
   (reconcile FLOOR) ───────────│  frontend/src/lib/api.ts  subscribeToRun()    │
                                │   switch(parsed.type):                         │
                                │     [Deep dispatch — BYTE-IDENTICAL, untouched]│
                                │     delta/sources/citations/tool_*/ask_user_*  │
                                │     ── ADDITIVE else-if BRANCHES (D-07) ──      │
                                │     phase_started → onPhaseStarted              │
                                │     phase_completed → onPhaseCompleted          │
                                │     phase_transition → onPhaseTransition        │
                                │     gate_failed → onGateFailed                  │
                                │     run_failed → onRunFailed                    │
                                │     run_completed → onRunCompleted              │
                                └───────────────┬──────────────────────────────-─┘
                                                │  makeStreamCallbacks demux
              ┌─────────────────────────────────┼──────────────────────────────┐
              ▼ (PANEL-ONLY)                     ▼ (CHAT — unchanged)            ▼
   phasesByThread:Map<tid,Phase[]>   bucketsBySurface (NEVER touched      tasksByThread
   (NEW slice; onPhase* writers)      by phase events — PANEL-09)         (sub_agent_*; exists)
              │                                  │                               │
              ▼ usePhases(tid)                   ▼ useThreadMessages(tid)         ▼ useTasks(tid)
   ┌─────────────────────────┐        ┌──────────────────────┐        (batch summaries, D-06)
   │ WorkspacePanel body:    │        │ MessageList / chat   │
   │  PendingAskStack (top)  │        │  (ZERO re-render on  │
   │  Todos / Files / Vers.  │        │   phase events)      │
   │  PhaseTimeline ◄─NEW    │        └──────────────────────┘
   │   PhaseCard × N (spine) │
   └─────────────────────────┘
```

A reader can trace the primary use case: a harness run XADDs `phase_started` → `subscribeToRun` hits the NEW additive branch → `onPhaseStarted` writes `phasesByThread` (NOT `bucketsBySurface`) → `usePhases` re-renders ONLY the `PhaseTimeline`, never the chat list.

### Verified Integration Map (re-confirmed against live code 2026-06-04)

#### 1. `frontend/src/lib/api.ts` — the SSE dispatch (D-07 attach point)
- **`StreamCallbacks` interface:** declared at **line 223**. New optional callbacks (`onPhaseStarted?`, `onPhaseCompleted?`, `onPhaseTransition?`, `onGateFailed?`, `onRunFailed?`, `onRunCompleted?`) append here, mirroring the `onCapPaused?` shape (line 311) and `onTaskStart?`/`onTaskDone?` (lines 341/344). [VERIFIED]
- **The dispatch switch:** lines **485–667**. The Deep dispatch Deep depends on:
  - `delta` (485), `reasoning_delta` (486), `tool_preparing/start/args_progress/end` (490–505), `sub_agent_start/done` TASK variant (511–532), `code_execution_*` (537–555), `sources/citations/confidence` (566–575), `todo_updated/workspace_file_*` (582–599), `ask_user_prompt/response` (600–613), terminal `done/stream_end/error/timed_out/cancelled` (614–647), `planning/iteration_start/fallback_model/cap_paused` (648–667).
- **CONFIRMED NEGATIVE (the heart of 094):** Grep for `phase_started|phase_completed|phase_transition|gate_failed|run_completed|run_failed` across ALL of `frontend/src` = **ZERO matches**. No handler exists anywhere. These events are dropped today. [VERIFIED — high confidence; this is the falsifiable claim the whole phase rests on.]
- **WHERE to attach:** the new `else-if` branches insert AFTER `cap_paused` (667) and BEFORE the closing `}` of the switch (line 667→668), OR interleaved among the non-terminal branches — but they MUST carry NO `return` (so the cursor-advance block at 676–679 still fires, exactly like the `todo_updated`/`ask_user_prompt` panel branches). They must NOT alter any existing branch. ⚠️ The CONTEXT says "~485–667"; the precise terminal-branch cutoff is 667 — verified.
- **Demux:** the callbacks fire `useStreamsStore.getState().actions.*ForThread(threadId, …)` — the streamsStore demux convention (see #3).

#### 2. `frontend/src/providers/StreamsProvider.tsx` — `makeStreamCallbacks` + store actions + selectors
- **`makeStreamCallbacks` factory:** declared at **line 278**; the panel-event default bindings are at **lines 681–720** (`onTodoUpdated`, `onWorkspaceFile*`, `onAskUserPrompt`, `onTaskStart`/`onTaskDone`, `onCapPaused`). New `onPhase*` defaults attach in this exact block, each calling `useStreamsStore.getState().actions.<setPhasesForThread|appendPhaseForThread|…>(threadId, …)`. [VERIFIED]
- **Store action bodies:** registered in the provider's mount-time `useEffect` setState block — the `tasksByThread` mutators are at **lines 1806–1837** (`setTaskForThread`/`updateTaskStatusForThread`/`replaceTasksForThread`), the `workflowLock` mutators at **1842–1849**. New phase mutators (`setPhaseStatusForThread`, `appendPhaseForThread`, `replacePhasesForThread`) follow the identical `new Map(prev)` copy-then-mutate immutable-replace shape. [VERIFIED]
- **Named selector hooks (the PANEL-09 boundary):**
  - `useThreadMessages` (**line 1974**) reads `state.bucketsBySurface.get(surfaceId)?.get(threadId)` EXCLUSIVELY. [VERIFIED — this is why chat can't re-render on phase events.]
  - `useTodos`/`useWorkspaceFiles`/`useAskUserPrompt`/`useTasks` (lines 1993/2012/2033/2052) each select ONLY their dedicated Map via `usePanelReconcile`. The new `usePhases(threadId)` attaches alphabetically among these, returning `{data, isLoading, error, reconcile}` with `fetcher: getThreadWorkflow` (or a phase-specific GET).
  - `useWorkflowLockForThread` (**line 2132**) reads `workflowLockByThread.get(threadId) ?? null` — D-02's server-truth source.
- **Anti-pattern guard:** the new `usePhases` MUST NOT be read by any chat component (`MessageList`/`MessageItem`/`ChatArea` message render). Only `WorkspacePanel`/`PhaseTimeline` read it.

#### 3. `frontend/src/stores/streamsStore.ts` — the `phasesByThread` slice
- **Where it attaches:** beside `workflowLockByThread` (interface **line 135**, default **line 258**). It mirrors the `tasksByThread: Map<string, TaskRunIndexItem[]>` shape (interface line 120, default line 254). [VERIFIED]
- **The `Phase` shape (per DATA-CONTRACT §3(b)):** `{slug, phaseIndex, phaseType, status, attempt?, error?, subAgents: pointer-or-rows, pendingAsk: pointer}`. `status ∈ {pending, running, done, failed, retrying, skipped}`.
- **Action stubs:** add no-op `() => {}` stubs in the `actions` block (lines 272–286), NOT `notMounted` — panel SSE dispatch can fire before the provider's mount-time useEffect (the PANEL-06 / Pitfall-5 discipline, documented at lines 268–271). [VERIFIED pattern]
- **Persistence:** start EMPTY like `pendingAsksByThread`/`workspaceFilesByThread` (ephemeral; reconciled from `getThreadWorkflow` on every mount). Do NOT add to `streamsCache` (D-086-03 convention).

#### 4. `frontend/src/components/panel/WorkspacePanel.tsx` — the 5th section
- **Body structure:** lines **104–138**. Sections mount inside `body`, gated on `hasActivity` (line 95-96: `todos.length>0 || files.length>0 || pendingAsks.length>0`). [VERIFIED]
- **REQUIRED CHANGE:** extend `hasActivity` to include `phases.length > 0` (so the panel does NOT short-circuit to `PanelEmpty` during a harness run that has phases but no todos/files/asks). Per UI-SPEC Copywriting "Panel empty": the timeline section mounts when `mode==='harness' OR phases exist`.
- **Where the section attaches:** after the `Versions` `PanelSection` (line 126–134), add a `PhaseTimeline` section. Add `const { data: phases } = usePhases(threadId)` next to lines 85–87.
- **PANEL-08 auto-open:** the panel's open/rail state machine is LIFTED to `ChatLayout` (per the file header, Plan 06). Auto-open-on-Harness rides the existing `subscribeOpenPanel(onExpand)` seam — confirm the harness-kickoff path triggers `onExpand` (the Phase-092 `subscribeOpenPanel` already force-opens for panel-owned tools). The planner should verify the open trigger in `ChatLayout` (not re-researched here — out of the explicit anchor set; flag as a small open question).

#### 5. `frontend/src/components/chat/ChatArea.tsx` — D-02 mode label
- **Current state:** `const [workflowMode, setWorkflowMode] = useState<"deep"|"harness">("deep")` at **line 68**; reset to `"deep"` on thread switch (**line 120**) BEFORE the mount reconcile lands (lines 153–179). [VERIFIED]
- **Two roles today:** `workflowMode` is (a) the composer LAUNCH toggle (which workflow to kick off — used at line 307 `workflowMode === "harness" && selectedWorkflowId`), and (b) the implicit displayed-mode source (stale).
- **D-02 fix (surgical):** the server-truth signal ALREADY exists — `const workflowLock = useWorkflowLockForThread(thread?.id ?? null)` (**line 83**) and `const workflowLocked = workflowLock !== null` (**line 84**), reconciled from `getThreadWorkflow` (lines 153–179, which sets the lock when `state.locked && !state.lock_is_stale && state.active_workflow_run_id`). The **displayed mode badge** must read `workflowLocked ? "harness" : "deep"` (server truth), NOT `workflowMode`. The LAUNCH toggle (`workflowMode`/`setWorkflowMode`) stays AS-IS for kickoff. This is a read-derivation change, not a state-shape change.
- ⚠️ Note: the mode badge surface is a panel/chip per the UI-SPEC ("there is no Deep/Harness pill to mislabel"). The planner verifies the exact badge render site (likely the running-workflow status chip + panel mode tag) — DATA-CONTRACT §4.1 "Mode badge" + §4.5 "Panel mode tag" both key off `mode`/`workflowLock`.

#### 6. `frontend/src/components/panel/PendingAskCard.tsx` — D-06 draft render
- **Current props:** destructures `{ tool_call_id, prompt, timeout_seconds, run_id }` from `ask` (**line 53**) + `options` (line 57). **Does NOT read `ask.draft`** despite it being on the type. [VERIFIED]
- **`PendingAsk.draft` exists:** `draft?: string` (`frontend/src/types/index.ts:311`, D-12 Phase 093). Populated by `api.ts:610` (`draft: parsed.draft`). [VERIFIED]
- **D-06 add:** a `DraftBlock` ABOVE the prompt (`{prompt}` at line 179) — amber `DRAFT · awaiting your review — not yet saved` (mono tag) + draft body, faded-mask preview when long + `⤢ Review & edit full draft` opening a `Dialog` wide overlay (`min(760px,88%)`, per UI-SPEC Interaction Contract "Long content = preview + open-wide"). Wordcount computed from `ask.draft.length` at render. Guard: `ask.draft` undefined (older streams) → hide the draft block entirely, show question only (DATA-CONTRACT §6 DRAFT-MISSING). Zero backend.
- **Batch summaries (D-06 second half):** `sub_agent_done.summary` is already in `tasksByThread` (`TaskRunIndexItem.summary`, types/index.ts:319). A `BatchResultList` reads `useTasks(threadId)` and renders per-subtopic `{description → summary}` rows. PANEL-09: this reads `tasksByThread` (already panel-only), not chat.

#### 7. `backend/app/services/harness_engine.py` — D-04 RC-4 fix (the ONE backend touch)
- **Success path (the template to mirror):** `await _surface_final_answer(ctx, run_id, stream_run_id, redis, pool)` at **line 822**, then `_emit(run_completed)` at 823. `_surface_final_answer` (defined **line 235**) persists via lazy-imported `insert_assistant_message` from `app.db.runs` (line 332-346): params `(pool, thread_id, user_id, content, source_refs, confidence_*)`, reading `ctx.thread_id` + `ctx.current_user["id"]`. [VERIFIED]
- **Failure path #1 — `fail_run` (lines 699–709):** `fail_phase` → `finish_run(pool, run_id, "failed")` → `write_audit("run_failed", {reason})` → `_emit("run_failed", reason=outcome.reason)` → **`return`** with NO message persist. [VERIFIED — the RC-4 bug.]
- **Failure path #2 — `skip_to_phase` runtime-guard (lines 712–735):** when a skip target is missing at runtime: `finish_run("failed")` → `write_audit("run_failed", {reason})` → `_emit("run_failed", reason)` → **`return`** with NO message persist. [VERIFIED — SECOND failure site the CONTEXT's single "~699–709" anchor does NOT mention. The fix must cover BOTH return sites, else a skip-guard failure still renders empty.]
- **The fix shape:** add a `_surface_failure_message(ctx, run_id, reason, pool)` helper (mirror the persist block of `_surface_final_answer`: lazy-import `insert_assistant_message`, read `ctx.thread_id`/`ctx.current_user["id"]`, `content = <failure-reason string>`, grounding params None). Call it at BOTH failure sites BEFORE the `return`, AFTER the `_emit("run_failed")`. The content string maps to the closed taxonomy (`max_steps`/`gate_failed`/`wall_clock_timeout`/`reason_unknown`) — but the simplest durable fix is to persist `reason` verbatim (the UI keys failed-with-reason off the `run_failed`/`gate_failed` SSE for live; the persisted row is the reconcile floor so a reload renders failed, not empty).
- **Deep byte-identical guard:** the helper lives INSIDE `harness_engine.py`, called only from `run_workflow`'s harness-only failure branches. It MUST NOT touch `_shielded_finalize` (the shared Deep+harness terminal path — referenced at lines 246/808/818/1003 but defined elsewhere, likely `threads.py`/`runs.py`). Deep's `_surface_final_answer` is unrelated; Deep never hits these harness failure branches. [VERIFIED the boundary.]
- **Reconcile read of the failure message:** after the fix, `GET /threads/{id}/messages` returns the assistant failure row; `GET /threads/{id}/workflow` returns `run_status: "failed"`. The UI renders failed-with-reason. ⚠️ Confirm `insert_assistant_message` has no required grounding param that breaks on a failure message — `_surface_final_answer` passes `source_refs=None`/`confidence_*=None` cleanly when empty, so the failure call is a strict subset.

#### 8. Reconcile endpoint `GET /threads/{id}/workflow` — confirmed
- **Endpoint:** `@router.get("/{thread_id}/workflow", response_model=ThreadWorkflowState)` at **`threads.py:1592`** (CONTEXT cited 1659 — minor drift; the endpoint EXISTS). [VERIFIED]
- **`ThreadWorkflowState` shape (`models/thread.py:48-86`):** `thread_id, mode("deep"|"harness"), locked, active_workflow_run_id, run_status, definition_slug, definition_name, current_phase_slug, current_phase_index, total_phases, lock_is_stale, cap_paused, continues_used, continues_remaining, latest_producer_run_id`. [VERIFIED — carries EVERYTHING the timeline needs to seed: `total_phases`/`current_phase_index`/`current_phase_slug` give the "Phase i/N" floor; `mode`/`definition_name` give the header; `latest_producer_run_id` re-attaches the live stream.]

### Pattern: Additive SSE branch (PANEL-06 isolation pattern)
**What:** A new wire event becomes panel state in exactly ONE place — an `else-if` branch in `api.ts` calling a panel-only callback → a dedicated per-thread Map. Chat selectors read `bucketsBySurface` only.
**When to use:** Every new `phase_*`/`gate_failed`/`run_failed` event.
**Example (the existing precedent the new branches copy):**
```typescript
// Source: frontend/src/lib/api.ts:582-583 (todo_updated — the PANEL-06 precedent)
else if (t === "todo_updated" && callbacks.onTodoUpdated)
  callbacks.onTodoUpdated((parsed.todos ?? []) as Todo[])
// NO `return` → the cursor-advance block at 676-679 still fires. New phase
// branches follow this EXACT shape (no return, panel-only callback).
```

### Pattern: Reconcile-then-live (D-v2.5-03, the anti-drift rule)
**What:** On mount, `getThreadWorkflow` seeds `total_phases`/`current_phase_index`/`mode`/lock; then live events mutate forward. Reconcile is the FLOOR — **live NEVER moves a counter backward.**
**When to use:** Timeline mount + reconnect; the "Phase i/N" counter.
**Example:** `ChatArea.tsx:153-179` already reconciles into `workflowLock`; the new `usePhases` reconcile seeds skeleton pending rows from `total_phases` with the current one `running` (DATA-CONTRACT §6 LOADING — the spinner-killer).

### Anti-Patterns to Avoid
- **Reading `phasesByThread` from a chat selector** → breaks PANEL-09 (chat re-renders on phase events). The named-hook boundary structurally prevents it; do not add a phase read to `useThreadMessages` or any chat component.
- **Putting the RC-4 fix in `_shielded_finalize`** → breaks Deep byte-identical (it runs for both). Keep it in `run_workflow`.
- **Writing `var(--accent-violet)` before the token migration** → resolves to nothing → transparent/broken CSS (DATA-CONTRACT §8-#19). D-05 lands FIRST.
- **Faking per-phase tool/source counts** → forbidden (D-03). They fire on the invisible sub-stream. SUPPRESS the chip until a real producer source exists.
- **Rendering a `gate_passed` glyph from an event** → no such event (`harness_engine.py:497-500` is audit-only, no `_emit`). Infer "passed" from the phase advancing.
- **Receipt phase-dots all-green** → must read real per-phase `status` (incl. failed/running/locked).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE line parsing | A new stream reader | The existing `subscribeToRun` loop (`api.ts:467-680`) | Handles CRLF/LF, cursor ids, malformed-line recovery, abort. Just add branches. |
| Per-thread panel state | A new context/store | The `phasesByThread` slice mirroring `tasksByThread` | Copy-then-mutate + no-op stubs + named-hook isolation are all proven (Phase 086). |
| WCAG axe assertions | A custom contrast checker | `vitest-axe` `toHaveNoViolations` (wired in `setupTests.ts`) | Already installed + the A11Y-03 gate per UI-SPEC. |
| Wide-content overlay | A custom modal | shadcn `Dialog` (already installed) | UI-SPEC Registry Safety: compose, don't add. |
| Phase accordion | Custom show/hide | shadcn `Collapsible` + APG `<button aria-expanded aria-controls>` | UI-SPEC §A11Y pre-specifies the APG pattern. |
| Failure-message persist | A new DB writer | `insert_assistant_message` (lazy-import from `app.db.runs`) | The success path already uses it (`harness_engine.py:332`); mirror it. |
| Reconcile fetch | A new endpoint | `GET /threads/{id}/workflow` (exists, `threads.py:1592`) | Carries `total_phases`/`current_phase_index`/`mode`/`definition_name` — everything needed. |

**Key insight:** Every primitive 094 needs already exists in the repo. The phase is composition + discipline, not construction. The single net-new artifact with no direct precedent is the `_surface_failure_message` backend helper — and even that is a strict subset of `_surface_final_answer`.

## Runtime State Inventory

> 094 is NOT a rename/refactor/migration phase — it is additive wiring + rendering + one backend persist. No stored strings change keys; no service config, OS state, secrets, or build artifacts are renamed. This section is included only to state that explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — verified: no DB key/collection/user_id is renamed. The RC-4 fix ADDS a `messages` row on the failure path (new write, not a key change); it uses the existing `messages` schema + `insert_assistant_message`. No migration. | None (data write, not migration). |
| Live service config | **None** — verified: no n8n/Datadog/external config touched. | None. |
| OS-registered state | **None** — verified: no Task Scheduler / pm2 / systemd. | None. |
| Secrets / env vars | **None** — verified: no SOPS/.env/CI var renamed. | None. |
| Build artifacts | **None** — verified: no package rename; no egg-info/Docker tag. `--accent-violet` is a CSS token (Tailwind rebuilds on `vite build` automatically). | None. |

## Common Pitfalls

### Pitfall 1: The additive-only SSE trap (Deep regression)
**What goes wrong:** Editing or reordering an existing branch in the `api.ts` switch (485–667) breaks Deep's `delta`/`sources`/`citations`/tool dispatch, causing cross-provider regressions across all 6 native providers.
**Why it happens:** The new branches are interleaved into a 180-line switch; an accidental edit to a neighbor is easy.
**How to avoid:** Add ONLY new `else-if` branches; never touch an existing one. Acceptance grep: the Deep branch lines (`delta` 485, `sources` 566, `tool_end` 504, `ask_user_prompt` 600) must be BYTE-IDENTICAL pre/post (`git diff` shows only additions). New branches carry NO `return`.
**Warning signs:** A Deep chat run loses its sources panel, or a tool result stops rendering — the smoke test is a Deep send still streaming an answer + sources.

### Pitfall 2: The byte-identical-Deep guard on the RC-4 fix
**What goes wrong:** Putting the failure-persist in `_shielded_finalize` (the shared terminal path) makes Deep persist an extra/duplicate message → the 075.x double-answer class of defect.
**Why it happens:** `_shielded_finalize` is the obvious "finalize" hook, but it runs for BOTH Deep and harness.
**How to avoid:** The helper lives in `harness_engine.py`, called only from `run_workflow`'s two harness-only failure branches. `_shielded_finalize` is untouched. Acceptance: `git diff` on the shared finalize path = empty.
**Warning signs:** A Deep run produces two assistant messages, or a Deep failure starts persisting where it didn't before.

### Pitfall 3: `var(--accent-violet)` before the token migration
**What goes wrong:** Any component rendering `text-accent-violet`/`border-accent-violet` before D-05 lands → the CSS variable resolves to nothing → transparent or broken color (the `retrying` row / `llm_batch_agents` border vanish).
**Why it happens:** The token exists in the SKETCH theme (`sources/themes/default.css`) but NOT in live `index.css` (verified: zero matches) nor `tailwind.config.js` (verified: zero matches).
**How to avoid:** D-05 is the FIRST task. Add to both `:root` (after line 61) and `.dark` (after line 125) in `index.css`, register in `tailwind.config.js` (after line 54), THEN render purple.
**Warning signs:** The retrying glyph or batch-agent left-border is invisible in one or both themes.

### Pitfall 4: `--muted-foreground-dim` for meaningful timeline text (both-themes contrast fail)
**What goes wrong:** Status/title/timestamp text set in `--muted-foreground-dim` fails 4.5:1 (measures **3.59:1** on the dark `--panel-surface`, per `index.css:108-110`).
**Why it happens:** The dim token reads "muted" and is tempting for meta.
**How to avoid:** Use `--color-text` or the panel-status tokens (`--panel-status-done` 10.63:1 dark / 4.72:1 light; `--panel-status-active` 10.48:1 dark / 5.15:1 light — verified in `index.css:122-125`/`58-61`). Dim is ONLY for decorative meta reinforced by an adjacent legible element. Caught by `vitest-axe` + manual Chrome MCP both-themes.
**Warning signs:** axe color-contrast violation; a phase title that's hard to read on either theme.

### Pitfall 5: Suppress-don't-fake the invented counts
**What goes wrong:** Rendering "6 searches / 16 tool calls / 48 sources" per-phase — these fire on `run:{sub_run_id}` (the sub-agent stream), invisible to the producer (DATA-CONTRACT §8-#1/#2/#8).
**Why it happens:** The operator's #1 bar mentions these counts; the temptation is to show a number.
**How to avoid:** SUPPRESS the chip until a real producer source exists (Build-Prereq B → SEED-053). Render ONLY: agent count (client tally of `sub_agent_start`), `Phase i/N`, run-level end-of-run `sources.length`, per-subtopic `summary`. The honest subset meets the operator's SPIRIT.
**Warning signs:** A count chip shows a per-phase number that can't be traced to a producer event tally.

### Pitfall 6: Per-thread timeline isolation under parallel streams
**What goes wrong:** Thread A streaming a Harness run corrupts Thread B's timeline (or B's prompt re-renders A's panel).
**Why it happens:** A global flag instead of per-thread keying (the BUG-260523-01 class).
**How to avoid:** `phasesByThread` is keyed by the OWNING thread id (the `makeStreamCallbacks` factory closes over `threadId` — see the `onCapPaused` precedent at `StreamsProvider.tsx:714-720`). `usePhases(threadId)` reads keyed. NEVER a global.
**Warning signs:** Switching threads mid-run shows the wrong timeline; a background harness run mutates the viewed thread.

### Pitfall 7: The second failure-return site (skip_to_phase guard)
**What goes wrong:** Fixing only the `fail_run` branch (699–709) leaves the `skip_to_phase` runtime-guard (712–735) still persisting nothing → a missing-skip-target failure renders empty.
**Why it happens:** The CONTEXT anchor cites only "~699–709".
**How to avoid:** Both failure-return sites in `run_workflow` call `_surface_failure_message` before `return`. Acceptance: grep both `_emit(... "run_failed" ...)` + `return` sites have a preceding persist call.
**Warning signs:** A workflow with a dangling skip target renders empty instead of failed-with-reason.

## Code Examples

### Adding a phase SSE branch (additive, no return)
```typescript
// Source: frontend/src/lib/api.ts — NEW branches mirror the todo_updated pattern (582)
else if (t === "phase_started" && callbacks.onPhaseStarted)
  callbacks.onPhaseStarted({
    phase: parsed.phase as string,
    phaseIndex: parsed.phase_index as number,
    phaseType: parsed.phase_type as string,   // the 5-literal discriminator
  })
else if (t === "phase_completed" && callbacks.onPhaseCompleted)
  callbacks.onPhaseCompleted(parsed.phase as string, parsed.phase_index as number)
else if (t === "gate_failed" && callbacks.onGateFailed)
  callbacks.onGateFailed({
    phase: parsed.phase as string,
    attempt: parsed.attempt as number,
    error: parsed.error as string,            // validator msg OR "wall_clock_timeout after Ns"
  })
else if (t === "run_failed" && callbacks.onRunFailed)
  callbacks.onRunFailed(parsed.reason as string | undefined)
// NO `return` on any of these — cursor-advance (676-679) must still fire.
```

### The panel-only demux (mirrors onTaskStart, StreamsProvider.tsx:691)
```typescript
// Source: frontend/src/providers/StreamsProvider.tsx — new onPhase* default
onPhaseStarted: (p) =>
  useStreamsStore.getState().actions.appendPhaseForThread(threadId, {
    slug: p.phase, phaseIndex: p.phaseIndex, phaseType: p.phaseType,
    status: "running", subAgents: [], pendingAsk: null,
  }),
// Closes over `threadId` (the OWNING thread) — Pitfall 6 isolation by construction.
```

### The RC-4 backend persist (mirrors _surface_final_answer, harness_engine.py:332)
```python
# Source: backend/app/services/harness_engine.py — NEW _surface_failure_message,
# called at BOTH failure-return sites (the fail_run branch ~709 AND the
# skip_to_phase guard ~734) BEFORE `return`. NOT in _shielded_finalize.
from app.db.runs import insert_assistant_message
from app.services.agent_loop import _strip_nul
_thread_id = getattr(ctx, "thread_id", None)
_user_id = (getattr(ctx, "current_user", None) or {}).get("id")
if _thread_id and _user_id:
    await insert_assistant_message(
        pool,
        thread_id=UUID(_thread_id) if isinstance(_thread_id, str) else _thread_id,
        user_id=UUID(_user_id) if isinstance(_user_id, str) else _user_id,
        content=_strip_nul(reason or "Failure reason not captured by the backend."),
    )  # grounding params omitted (None) — a strict subset of the success persist.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Harness lifecycle events dropped by `api.ts` (chat = "Setting up…" → pulse → full answer) | Additive `phase_*` branches → `phasesByThread` → live panel timeline | Phase 094 (this) | The spinner-killer; PANEL-08. |
| Failed harness run renders as silent empty `done` (RC-4) | Failure persists a real `messages` row + UI renders failed-with-reason | Phase 094 (D-04) | Honesty by construction; finding #3. |
| Mode label from stale `ChatArea useState` (reads "Deep" during a Harness run) | Mode derived from `active_workflow_run_id` server truth | Phase 094 (D-02) | Finding #5 killed by construction. |
| Draft before `ask_user` invisible (you review what you can't see) | `PendingAskCard` renders `ask.draft` (preview + open-wide) | Phase 094 (D-06) | Finding #2; data already on wire post-093-05. |

**Deprecated/outdated:**
- The "Deep RunCard relocated into the panel" + "Deep chat-seam" rows of the UI-SPEC are UNUSED in 094 (D-01 subtraction, not new work).
- The composer 2-pill redesign + Workflows page rows of the UI-SPEC are DESIGN-AHEAD only (v2.9).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The PANEL-08 "auto-open on entering Harness Mode" rides the existing `subscribeOpenPanel(onExpand)` seam in `ChatLayout` (not re-verified — outside the explicit anchor set). | Integration Map #4 | LOW — if the seam doesn't already fire on harness kickoff, a small `onExpand` call is needed at the kickoff path. Planner verifies `ChatLayout` open-trigger. |
| A2 | `insert_assistant_message` accepts a failure `content` with all grounding params None without error (inferred from `_surface_final_answer` passing None cleanly). | Integration Map #7 | LOW — the success path proves the None-param shape; a failure message is a strict subset. |
| A3 | The displayed mode badge render site (panel mode tag + running-workflow status chip) reads `mode`/`workflowLock` and is the only D-02 touch (the exact JSX site not line-anchored here). | Integration Map #5 | LOW — DATA-CONTRACT §4.1/§4.5 both key the badge off `mode`; the signal (`workflowLock`) is confirmed present at `ChatArea.tsx:83`. Planner pins the JSX site. |
| A4 | The closed failure taxonomy (`max_steps`/`gate_failed`/`wall_clock_timeout`/`reason_unknown`) is a UI-derived classification over `gate_failed.error` + which event fired — no backend typed `failure_kind` field. | Validation / RC-4 | NONE — explicitly confirmed by DATA-CONTRACT §8-#14 + the verified `gate_failed` payload `{phase,attempt,error}` (harness_engine.py:486/522). Listed for completeness. |

**Note:** A1–A3 are LOW-risk verification items for the planner, not unverified decisions. All load-bearing claims (the missing SSE branches, the two failure-return sites, the token absence, the selector boundary, the reconcile shape, `PendingAsk.draft`) were VERIFIED against live code this session.

## Open Questions (RESOLVED — pinned at plan time against live code)

1. **PANEL-08 auto-open trigger location.** → **RESOLVED:** `ChatLayout.tsx:106` exposes the `subscribeOpenPanel(expand)` seam; Plan 094-03 fires `requestOpenPanel()` at harness kickoff (force-open the panel to the timeline).
   - What we know: the panel open/rail machine is lifted to `ChatLayout`; a `subscribeOpenPanel(onExpand)` seam exists (per `WorkspacePanel.tsx` header). Harness kickoff sets `workflowLock`.
   - What's unclear: whether harness kickoff already force-opens the panel, or needs an `onExpand` nudge.
   - Recommendation: planner greps `ChatLayout` for `subscribeOpenPanel`/`onExpand` and the harness-kickoff path; add a one-line force-open if absent. Small, low-risk.

2. **Exact D-02 mode-badge JSX site.** → **RESOLVED:** the badge renders in `MessageInput.tsx:348` (passed `workflowMode`); Plan 094-05 re-points it to a `displayedMode` derived from `workflowLock`/`active_workflow_run_id` (server truth).
   - What we know: the signal is `workflowLock` (`ChatArea.tsx:83`); the badge is a panel mode tag + running-workflow status chip (UI-SPEC).
   - What's unclear: the precise component file/line that renders the current (possibly stale-`workflowMode`-derived) badge.
   - Recommendation: planner greps for the mode-label render (likely in the composer/status-chip area passed `workflowMode={workflowMode}` at `ChatArea.tsx:363`) and re-points it to `workflowLocked`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm (vite/vitest) | Frontend build + tests | ✓ | existing | — |
| vitest | Validation Architecture | ✓ | 4.1.0 | — |
| vitest-axe | A11Y-03 gate | ✓ | 0.1.0 (wired in setupTests.ts) | — |
| Python venv + FastAPI | RC-4 backend fix + its test | ✓ | existing | — |
| Local Supabase (Docker) | A live RC-4 reconcile UAT (optional — unit test can use a fake) | ✓ (CLAUDE.md: auto-starts) | v2.101 | mock/fake-pool unit test |
| Chrome DevTools MCP | Manual both-themes contrast + parallel-thread + cross-provider UAT (SC#10 manual axes) | ✓ | — | — |
| Redis (Docker) | Live harness run for manual UAT (not needed for unit tests — fixtures replay raw bytes) | ✓ | existing | fixture replay |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None blocking — all automated validation runs under vitest/jsdom with no live services (fixtures replay raw SSE bytes through the real normalizer).

## Validation Architecture

> Nyquist validation is ENABLED (`config.json: workflow.nyquist_validation: true`). This section seeds VALIDATION.md and Dimension 8 of plan-checking. Each falsifiable invariant maps to a concrete method, leveraging the EXISTING gold-standard pattern in `panelHooks.test.tsx` (raw SSE bytes → REAL `subscribeToRun` → REAL `makeStreamCallbacks` → store assertion).

### Test Framework
| Property | Value |
|----------|-------|
| Framework (frontend) | vitest 4.1.0 + @testing-library/react 16.3.2 + vitest-axe 0.1.0 (jsdom) |
| Framework (backend) | pytest (existing harness suite — `backend/tests/test_09*`/`test_harness_*`) |
| Config file | `frontend/vitest.config.ts` (setupFiles `./src/setupTests.ts` — axe matchers wired) |
| Quick run command (FE) | `cd frontend && npx vitest run src/components/panel src/providers` |
| Full suite command (FE) | `cd frontend && npm run test` (= `vitest run`) + `npm run build` (tsc -b) |
| Quick run command (BE) | `cd backend && pytest tests/test_094_*.py tests/test_harness_engine*.py -x` (in venv) |
| Full suite command (BE) | `cd backend && pytest tests/` (touched-surface + harness) |

### The 5 falsifiable invariants → validation method

#### INV-1 — PANEL-09: a `phasesByThread` mutation triggers ZERO chat re-renders
- **Type:** unit (vitest), reference-identity assertion (the FC#1 pattern).
- **Method:** Mount `<StreamsProvider>`; capture `const before = useStreamsStore.getState().bucketsBySurface`; replay a `phase_started`+`phase_completed` fixture through the REAL `subscribeToRun` (via `mockSseFetch`); assert `expect(useStreamsStore.getState().bucketsBySurface).toBe(before)` AND `phasesByThread.get(threadId)` got the new phase.
- **Precedent:** `panelHooks.test.tsx:292-310` (FC#1 — already does exactly this for `todo_updated`). New file: `phasesByThread` variant.
- **Stronger form (optional):** a `renderHook(useThreadMessages)` render-count spy that stays at 1 across N phase events.
- **Command:** `npx vitest run src/providers/__tests__/phaseHooks.test.tsx`

#### INV-2 — A11Y-03: WCAG 2.1 AA, zero axe violations in every state + both themes
- **Type:** unit (vitest-axe) for structure/ARIA; manual (Chrome MCP/Lighthouse) for real both-themes contrast.
- **Method (automated):** Render `PhaseTimeline`/`PhaseCard`/`RunCard` against the DATA-CONTRACT §7 fixtures (`fx-run-running`, `fx-run-failed`, `fx-run-done`, `fx-run-askuser-paused`, `fx-run-gatefail-retry`) in each state (pending/running/done/failed/retrying) + 1-phase and N-phase → `expect(await axe(container)).toHaveNoViolations()`.
- **Unit-assert (UI-SPEC §A11Y test gate):** announcer (`role=status`) fires EXACTLY once per transition (no per-token spam); `aria-expanded` toggles on header click; `aria-busy` flips true→false on stream end; icon-only controls (Send→Stop `aria-label="Cancel run"`, rail toggle) expose an accessible name; keyboard `Enter`/`Space` toggles a terminal phase; forced-open active phase carries `aria-disabled="true"`.
- **Method (manual, both-themes contrast):** Chrome MCP renders the timeline in dark + light, verify status/title text ≥4.5:1 and the new `--accent-violet` graphic ≥3:1 / pill text ≥4.5:1 (UI-SPEC verified values: dark 4.35:1 graphic / 9.83:1 pill; light 8.52:1).
- **Precedent:** `setupTests.ts:6-8` (axe wired) + UI-SPEC §A11Y pre-specifies every assertion.
- **Command:** `npx vitest run src/components/panel/__tests__/PhaseTimeline.test.tsx`

#### INV-3 — RC-4 failure honesty: a failed/gate_failed run NEVER renders as empty done
- **Type:** backend unit (pytest) for the persist; frontend unit (vitest) for the render.
- **Method (backend):** drive `run_workflow` to BOTH failure-return sites (a `fail_run` outcome AND a missing-skip-target guard); assert a `messages` assistant row IS persisted with the failure reason as content; assert `_shielded_finalize` is NOT in the call path (Deep byte-identical — `git diff` on the shared path empty). Assert the empty-reason case persists the `reason_unknown` sentinel string, NEVER an empty content.
- **Method (frontend):** replay `fx-run-failed` (`run_failed{reason}` → terminal `done` RC-4 sentinel) → assert the timeline renders FAILED (keyed off `run_failed`), NOT done. Replay `fx-run-failed-reason-unknown` (`run_failed{reason:""}`) → assert the "Failure reason not captured" sentinel renders, never an empty red card.
- **Precedent:** backend `test_harness_*` retry/fail tests; frontend DATA-CONTRACT §7 fixtures.
- **Command:** `pytest backend/tests/test_094_rc4_failure.py -x` + `npx vitest run src/components/panel/__tests__/FailReason.test.tsx`

#### INV-4 — Reconcile-then-live: live NEVER moves a counter backward
- **Type:** unit (vitest).
- **Method:** seed via reconcile `{current_phase_index:1, total_phases:3}` ("Phase 2/3"); then replay live events that would (incorrectly) regress; assert the displayed `Phase i/N` only advances forward. Assert mount with reconcile-only (no live events) shows the full N-phase skeleton (pending rows + current running) from `total_phases` alone — the spinner-killer (DATA-CONTRACT §6 LOADING).
- **Precedent:** `fx-run-running` fixture (DATA-CONTRACT §7) + the `getThreadWorkflow` reconcile (`ChatArea.tsx:153-179`).
- **Command:** `npx vitest run src/components/panel/__tests__/PhaseReconcile.test.tsx`

#### INV-5 — SC#10 4-axis cross-provider UAT (cross-provider × multi-tool × parallel-thread × long-message)
- **Type:** mostly MANUAL (Chrome MCP, in VALIDATION.md) per CLAUDE.md "UAT scoreboard recipe"; the parallel-thread axis has an automatable unit form.
- **Automatable:** **parallel-thread isolation** — unit test: Thread A streams a harness run (replay phase events keyed to A) while Thread B receives a prompt; assert A's `phasesByThread` and B's are disjoint and B's chat is unaffected (the per-thread keying proof, Pitfall 6). This is the FC#5-style isolation already proven for `tasksByThread`.
- **Manual (VALIDATION.md rows):**
  - **Cross-provider:** run a Harness workflow on OpenAI, Anthropic, Google, OpenRouter (one model each) — the timeline + mode + RC-4 must render identically (honest signals are provider-agnostic by construction; NO provider-specific rendering).
  - **Multi-tool:** a workflow whose `llm_agent`/`llm_batch_agents` phase uses `search_documents` + `execute_code` — assert sub-agent child rows render; counts SUPPRESSED.
  - **Parallel-thread (live):** Thread A streaming a Harness run while Thread B accepts a prompt — timeline not corrupted, B's composer unlocked (the 075.3-regression-closed bonus).
  - **Long-message:** a ≥50-prior-message thread OR ≥5KB prompt running a workflow — timeline + draft preview hold.
- **Precedent:** `panelHooks.test.tsx` header explicitly maps "SC#10 axes 1-3 automatable, axis 4 manual"; the 4-axis bandwidth is the CLAUDE.md MANDATORY recipe.

### Sampling Rate
- **Per task commit:** `npx vitest run <touched panel/provider dir>` (< 30s).
- **Per wave merge:** `cd frontend && npm run test && npm run build` + `cd backend && pytest tests/test_094_*.py tests/test_harness_engine*.py`.
- **Phase gate:** full FE suite green + tsc -b clean + touched-surface BE suite green BEFORE `/gsd-verify-work`; then the manual SC#10 4-axis rows in VALIDATION.md (Chrome MCP, operator-owned).

### Wave 0 Gaps
- [ ] `src/providers/__tests__/phaseHooks.test.tsx` — INV-1 (PANEL-09 zero-chat-re-render) + the `phasesByThread` demux routing (mirror `panelHooks.test.tsx`).
- [ ] `src/components/panel/__tests__/PhaseTimeline.test.tsx` — INV-2 (axe, all states, 1+N phases).
- [ ] `src/components/panel/__tests__/FailReason.test.tsx` + `PhaseReconcile.test.tsx` — INV-3 (frontend) + INV-4.
- [ ] `backend/tests/test_094_rc4_failure.py` — INV-3 (backend persist at BOTH failure sites + Deep-untouched guard).
- [ ] DATA-CONTRACT §7 fixtures as a shared test module (`fx-phase-*`, `fx-run-*`) replayable through `subscribeToRun` (the §7 contract: flat string arrays matching the exact `_emit` wire shape).
- [ ] Framework install: NONE — vitest + vitest-axe + testing-library all present.

## Security Domain

> `security_enforcement` is not explicitly `false` in config (treat as enabled). 094 is a low-surface UI/render + one additive backend persist. The milestone's real security surface (RLS / tool-whitelist gate / server-side mode lock) lives in 090/091/092 and is handled at v2.8 closure via `/gsd-secure-phase` (per STATE.md CLOSURE CHECKLIST — security pass anchored on 092, NOT per-phase). 094 introduces no new auth/access-control surface.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface; reconcile + persist use the existing owner-scoped session. |
| V3 Session Management | no | Unchanged. |
| V4 Access Control | yes (inherited) | The RC-4 persist uses `ctx.current_user["id"]` + `ctx.thread_id` (the run owner) via `insert_assistant_message` — same owner-scoping as the success path. No IDOR surface added (the failure message is written for the run's own owner). [VERIFIED: `_surface_final_answer` reads the same `ctx` fields, owner-scoped.] |
| V5 Input Validation | yes | All agent-supplied text (phase slug, draft, summary, prompt, options, failure reason) renders as plain React text children — NEVER raw HTML (T-087-11 precedent in `PendingAskCard`). The RC-4 `content` passes through `_strip_nul`. No new injection surface. |
| V6 Cryptography | no | None. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via agent-rendered draft/summary/phase text | Tampering | Plain React text children (no `dangerouslySetInnerHTML`); the established panel convention. |
| Cross-thread state bleed (a background run mutating another thread's view) | Information Disclosure | Per-thread keying (`phasesByThread` keyed by owning threadId; `makeStreamCallbacks` closes over `threadId`). Not a security boundary per se but a correctness/isolation invariant (Pitfall 6 / INV-5). |
| Failure-message written for the wrong user | Elevation/Disclosure | The persist reads `ctx.current_user["id"]` (run owner) — identical to the success path; no cross-user write. |

## Sources

### Primary (HIGH confidence — verified against live code this session)
- `frontend/src/lib/api.ts` (lines 223, 311, 341/344, 485–667, 676–679) — the `StreamCallbacks` interface + the Deep dispatch switch + the CONFIRMED-NEGATIVE (no `phase_*` branch). Grep across `frontend/src` = zero `phase_started|phase_completed|phase_transition|gate_failed|run_completed|run_failed`.
- `frontend/src/providers/StreamsProvider.tsx` (278, 681–720, 1806–1849, 1974–2133) — `makeStreamCallbacks` factory + panel-event defaults + store-action bodies + named selectors (`useThreadMessages` reads `bucketsBySurface` only → PANEL-09 by construction; `useWorkflowLockForThread` = D-02 source).
- `frontend/src/stores/streamsStore.ts` (62, 99–135, 217–288) — the per-thread Map shapes; `phasesByThread` attaches beside `workflowLockByThread` mirroring `tasksByThread`; no-op stub convention (PANEL-06 / Pitfall 5).
- `frontend/src/components/panel/WorkspacePanel.tsx` (95–138) — the body/`hasActivity` mount gate; where the 5th `PhaseTimeline` section attaches.
- `frontend/src/components/panel/PendingAskCard.tsx` (52–57, 179) — confirms it receives `ask` but does NOT read `ask.draft`; the draft block inserts above the prompt.
- `frontend/src/components/chat/ChatArea.tsx` (68, 83–84, 120, 153–179, 307, 363) — the `workflowMode` useState (launch toggle) vs the `workflowLock` server-truth signal (D-02).
- `frontend/src/index.css` (37–61 `:root`; 66–126 `.dark`) — confirms `--accent-violet` ABSENT (zero matches); the `--panel-status-*` convention to mirror; the `--muted-foreground-dim` 3.59:1 fail.
- `frontend/tailwind.config.js` (53–54) — `--accent-violet` ABSENT; the `panel-status-*` registration to mirror.
- `frontend/src/types/index.ts` (299–319) — `PendingAsk.draft?` exists (D-12); `TaskRunIndexItem.summary` (batch summaries).
- `backend/app/services/harness_engine.py` (235–350 `_surface_final_answer`; 418–524 gate loop + `gate_failed{phase,attempt,error}` emits 486/522 + `gate_passed` audit-only 497–500; 570 `run_workflow`; 699–709 fail_run RETURN; 712–735 skip_to guard RETURN; 808–823 success surfacing) — the RC-4 two-site fix + the Deep byte-identical boundary.
- `backend/app/models/thread.py` (48–86) — `ThreadWorkflowState` reconcile shape.
- `backend/app/models/harness.py` (90–99) — the 5-literal `phase_type` discriminated union (`extra='forbid'`).
- `backend/app/api/threads.py` (1592) — `GET /{thread_id}/workflow` endpoint EXISTS.
- `frontend/src/providers/__tests__/panelHooks.test.tsx` (1–310) — the gold-standard validation pattern (raw SSE → real `subscribeToRun` → store; FC#1 reference-identity assertion).
- `frontend/src/setupTests.ts` (6–8) + `vitest.config.ts` — vitest-axe wired; A11Y-03 gate ready.
- `.planning/REQUIREMENTS.md` (39–44) — PANEL-08/09 + A11Y-03 definitions.

### Secondary (HIGH — the locked design contract)
- `094-UI-SPEC.md` — approved visual/interaction/copy/a11y/real-vs-invented contract (6/6 dimensions).
- `094-grounding/DATA-CONTRACT.md` (§2 phase-type shapes, §3 source-of-truth, §6 empty/loading/failed, §7 fixtures, §8 invented flags, §10 addenda) — the real-vs-invented authority; verified field-by-field against the wire emits this session.
- `094-CONTEXT.md` — D-01..D-07 (the scope/sequencing authority that narrows the UI-SPEC).
- `094-UI-FINDINGS-FROM-093-REUAT.md` — the 7 acceptance-bar findings the build is judged against.
- `sketch-findings-agentic-rag` SKILL — locked sketch winners 008–013.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; every primitive verified present in package.json + live code.
- Integration map / line anchors: HIGH — every CONTEXT/DATA-CONTRACT anchor re-confirmed against live files; the two drifts (reconcile endpoint 1592 not 1659; the SECOND failure-return site) are noted explicitly.
- RC-4 backend fix: HIGH — both failure sites + the success template + the Deep boundary verified.
- Pitfalls: HIGH — each grounded in a verified line anchor or a documented prior defect class.
- Validation architecture: HIGH — every invariant maps to an EXISTING working test precedent in the repo.

**Research date:** 2026-06-04
**Valid until:** ~2026-07-04 (30 days — stable surface; the only churn risk is unrelated edits to `api.ts`/`StreamsProvider.tsx`/`harness_engine.py`, which the planner should re-grep at plan time).

## RESEARCH COMPLETE

**Phase:** 094 - Workflow Legibility + Mode Clarity
**Confidence:** HIGH

### Key Findings
- **The whole phase rests on a verified negative:** `api.ts` has ZERO handlers for `phase_started`/`phase_completed`/`phase_transition`/`gate_failed`/`run_failed`/`run_completed` (confirmed across all of `frontend/src`). The events are wire-emitted, silently dropped. Clean additive insertion after the Deep dispatch (495–667; terminal cutoff at 667).
- **PANEL-09 is structurally guaranteed:** `useThreadMessages` (StreamsProvider:1978) reads `bucketsBySurface` exclusively; a `phasesByThread` slice (mirroring `tasksByThread`) cannot trigger a chat re-render. Provable via the existing FC#1 reference-identity pattern (`panelHooks.test.tsx:292-310`).
- **RC-4 has TWO failure-return sites, not one:** `fail_run` (699–709) AND the `skip_to_phase` runtime-guard (712–735) both emit `run_failed` and `return` without persisting. Both need the `_surface_failure_message` helper (mirror `_surface_final_answer`:332); both inside `run_workflow`, never `_shielded_finalize`. The CONTEXT's single "~699–709" anchor misses the second site.
- **D-02/D-06 are trivially confirmed:** the server-truth mode signal already exists (`workflowLock`, ChatArea:83); `PendingAskCard` already receives `ask` but doesn't read `ask.draft` (which exists on the type, populated at api.ts:610). Both pure-frontend.
- **D-05 broken-CSS trap is real:** `--accent-violet` is absent from `index.css` (both blocks) AND `tailwind.config.js` (zero matches). Must land FIRST; exact insert points anchored (index.css `:root` after :61, `.dark` after :125; tailwind after :54).
- **Validation infra is ready:** vitest 4.1.0 + vitest-axe 0.1.0 (wired in setupTests.ts) + the `panelHooks.test.tsx` raw-SSE-replay-through-real-normalizer pattern + DATA-CONTRACT §7 fixtures. Every invariant maps to an existing precedent.

### File Created
`.planning/phases/094-workflow-legibility-mode-clarity/094-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Zero new deps; all verified present. |
| Architecture / line anchors | HIGH | Every anchor re-verified live; 2 drifts noted. |
| RC-4 backend fix | HIGH | Both failure sites + template + Deep boundary verified. |
| Validation Architecture | HIGH | Existing working test precedent for each invariant. |

### Open Questions (LOW-risk, for the planner to pin at plan time)
1. PANEL-08 auto-open trigger location in `ChatLayout` (does harness kickoff already force-open the panel, or need an `onExpand` nudge?).
2. The exact D-02 mode-badge JSX render site (signal confirmed at ChatArea:83; badge JSX to pin).

### Ready for Planning
Research complete. The planner has verified line anchors for all 7 integration points (api.ts, StreamsProvider, streamsStore, WorkspacePanel, ChatArea, PendingAskCard, harness_engine), the two RC-4 failure sites, the D-05 token insert points, the real-vs-invented SUPPRESS guards, and a Validation Architecture mapping every falsifiable invariant to a concrete vitest/pytest method with an existing precedent. Sequence: D-05 token FIRST → SSE branches + phasesByThread → PhaseTimeline section → D-02/D-06 renders → D-04 backend RC-4 (parallelizable).
