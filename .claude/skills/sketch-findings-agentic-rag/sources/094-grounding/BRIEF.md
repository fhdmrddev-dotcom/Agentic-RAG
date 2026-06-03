# Phase 094 Sketch-Grounding BRIEF — Workflow Legibility + Mode Clarity

**Project:** Agentic RAG · **Phase:** 094 "Workflow Legibility + Mode Clarity"
**Purpose:** Single authoritative grounding document so a designer can build 6 HTML sketches that are FAITHFUL to the real system — real SSE events, real component shapes, real seed-workflow content, real mode truth, validated competitive patterns, and a concrete WCAG 2.1 AA spec.

**The 6 sketches this grounds:**
- **008 phase-timeline** — a live harness run rendered in the panel (operator's #1 acceptance bar: REAL steps/tasks, not a spinner)
- **009 unified-surface** — D-094-UNIFY: Deep AND Harness both live in the panel; chat keeps only prompt + final answer + a quiet "ran in workspace ▸" pointer
- **010 honesty-and-drafts** — failed-renders-as-failed-with-a-reason; visible draft-before-ask_user; batch sub-results; harness answer RunCard with multi-phase provenance
- **011 mode-and-composer** — General/Explorer × Deep/Harness clarity; simplified composer `[Model ▾][General/Explorer ▾]`; no more "Deep" label mid-Harness-run
- **012 workflows-page** — library + launcher (build NOW); renders existing `workflow_definitions`; Run → opens a thread; kills the composer dropdown
- **013 workflow-builder** — NL authoring vision (design NOW, build v2.9); read-mostly live diagram, describe→refine→publish, HITL

**North-star principle (D-094-UNIFY):** Deep and Harness are not two surfaces — they are two ways the SAME workspace panel gets driven. Chat is for conversation (prompt + final answer + a quiet "ran in workspace ▸" pointer); the panel is for execution legibility. Every sketch must reinforce: *one execution surface, two drivers*.

---

## 1. Real Event Vocabulary

All events ride the `run:{run_id}` Redis stream as `{data: JSON({type, ...fields})}` (producer `_emit` at `threads.py:144` / `harness_engine.py:105`). The frontend SSE consumer is `frontend/src/lib/api.ts` (branches roughly lines 485–657). **A "wire-only" event is emitted by the backend but has NO branch in api.ts — it is silently dropped.** This is the root of the "fake spinner" problem the timeline sketch (008) must fix.

### 1.1 Terminal sentinels (the REAL run-end signal)
`TERMINAL_TYPES` (`threads.py:129`), emitted via `_emit_terminal`, exempt from stream MAXLEN trimming:

| Sentinel | Meaning | Status mapped from (`_RUN_STATUS_TO_TERMINAL_TYPE:136`) |
|---|---|---|
| `done` | completed | `completed` |
| `error` | failed | `failed` |
| `cancelled` | cancelled | `cancelled` |
| `timed_out` | timed out | `timed_out` |

### 1.2 Harness engine lifecycle events — what fires at each moment

| Lifecycle moment | Event(s) on the wire | Payload fields | Emitted today? | Rendered today? |
|---|---|---|---|---|
| **Phase START** | `phase_started` (`engine:676`) + `write_audit phase_started` | `{phase: slug, phase_index: int, phase_type: str}` | YES (wire + audit) | **NO — wire-only, no api.ts branch** |
| **Phase COMPLETE** | `phase_completed` | `{phase, phase_index}` | YES | **NO — wire-only** |
| **Phase TRANSITION** | `phase_transition` (`:773`); skip variant adds `via:"skip_to_phase"` (`:718`) | `{from_phase, to_phase}` (+`via`) | YES | **NO — wire-only** |
| **GATE PASS** | (none on wire) — `write_audit gate_passed` ONLY (`:497`) | audit only | Audit-only | N/A — not on wire |
| **GATE FAIL (+retry)** | `gate_failed` SSE + audit, **every attempt** (`:522`); retry feeds `ctx.retry_feedback` | `{phase, attempt: int, error: str}` (error = validator message OR `"wall_clock_timeout after Ns"`) | YES | **NO — wire-only** |
| **Sub-agent SPAWN** | `sub_agent_start` on PRODUCER stream (`task_service:574`) | `{sub_run_id, description, tools: [str], max_steps}` | YES | YES — but rendered as **ghost avatars** (api.ts:511), no live drill-down |
| **Sub-agent heartbeat** | `iteration_start` on the SUB stream (`task_service:673`) | `{iteration}` | YES (on sub-stream) | YES |
| **Sub-agent DONE** | `sub_agent_done` on parent (`:876`) | `{sub_run_id, status, summary}` | YES | YES |
| **Tool CALL (inside agent)** | `tool_start` / `tool_end` — on the **SUB-agent's own stream** `run:{sub_run_id}`, NOT the harness producer stream. Harness engine itself emits no tool events. | tool name/args/result | YES (sub-stream) | YES on sub-stream; invisible on harness stream |
| **Intermediate / DRAFT output** | carried ONLY inside `ask_user_prompt`'s `draft` field (`phase_types:481`) + persisted in `messages.tool_calls.draft` (`:457`). Per-phase outputs are NOT individually surfaced. | `draft: str` | Persisted-in-prompt-row only | **NO standalone draft render** |
| **ask_user PAUSE** | `ask_user_prompt` (`phase_types:481`, also direct from `llm_human_input` executor); blocks on `subscribe_for_response` | `{tool_call_id, prompt, options: [str], timeout_seconds, draft: str}` | YES | YES — rendered (api.ts:600), panel surface |
| **ask_user ANSWER** | `ask_user_response` | `{tool_call_id, response_text/choice_index}` | YES | YES |
| **Phase FAIL** | `gate_failed` (terminal attempt) → then `phase_transition` (skip) OR `run_failed`; `fail_phase` DB write | as above | YES | wire-only |
| **Run COMPLETE** | `delta`(final_text) → `sources` → `citations` → `confidence` (`_surface_final_answer:280-307`) → `run_completed` (`:823`) → producer-shell emits terminal `done` | `run_completed{status:"completed"}` | YES | delta/grounding RENDERED; `run_completed` **wire-only**; the REAL terminal is `done` |
| **Run FAIL** | `run_failed` (`:708`) — **BUG (RC-4):** `run_workflow` returns NORMALLY after this, so the outer producer-shell `_terminal_status` stays `"completed"` and emits terminal `done` with empty content | `{reason: str}` | YES | `run_failed` **wire-only**; sentinel is WRONGLY `done` |

### 1.3 Deep agent-loop events (already rendered today, panel-relevant)
`delta`, `reasoning_delta`, `title`, `fallback_model`, `iteration_start`, `planning`, `system_warning`, `tool_preparing`, `tool_start`, `tool_args_progress`, `tool_end`, `sub_agent_start`, `sub_agent_delta`, `sub_agent_done`, `skill_activated`, `skill_loaded`, `code_execution_start`, `code_executing`, `code_stdout`, `code_stderr`, `code_execution_complete`, `final_output_files`, `sources`, `citations`, `confidence`, `todo_updated`, `workspace_file_written`, `workspace_file_deleted`, `ask_user_prompt`, `ask_user_response`, `suggestions`, `cap_paused`, `stream_end`.

### 1.4 The 5 phase types (the discriminated union the timeline renders)
From `backend/app/models/harness.py` (config) + `backend/app/services/harness/phase_types.py` (executors):

1. **`programmatic`** — pure Python from `PROGRAMMATIC_PHASE_REGISTRY` (e.g. `split_topic`). No LLM, no tools. Instant. Returns structured data. *(plain: a fixed server function runs, no AI.)*
2. **`llm_single`** — one bounded `_stream_one_iteration` call, no tools. Returns `{text}`. *(plain: one AI message — think/write step.)*
3. **`llm_agent`** — one bounded sub-agent via `run_task_sub_agent` over a per-phase tool whitelist; `max_steps=12`, optional `wall_clock_seconds`. Returns `{text, sub_run_id, source_refs, citations, similarity_scores}`. *(plain: one AI agent using allowed tools, looping until done.)*
4. **`llm_batch_agents`** — N parallel sub-agents (one per `split_topic` sub-question), `max_parallel_agents=5` (Semaphore-bounded), `merge_strategy: concat | concat_numbered`. Returns `{text, sub_run_ids[], ...grounding}`. *(plain: many AI agents at once, results merged.)*
5. **`llm_human_input`** — ask_user pub/sub pause; `prompt`, `options[]`, `timeout_seconds=300` (hard cap 1800s). Returns `{text, answer, tool_call_id}`. *(plain: pauses, waits for a human.)*

**There is NO `code_exec` phase type** — `execute_code` is a TOOL available inside an `llm_agent` phase, not a phase type.

**Gates (ValidatorSpec):** kinds = `json_schema`, `regex_match`, `workspace_file_exists`, `programmatic`; `on_failure` = `fail_run | retry | skip_to_phase:<slug>`; `max_retries=2` (≤3 attempts total). **NOTE: after migration 065 NONE of the 4 shipped seeds carry an active gate** (see §3) — but the timeline must still be able to render a gate state because authored workflows (013) can have them.

### 1.5 The gap findings the sketches MUST honor
- **RC-4 (failed run renders as `done`):** designers must key failure off `run_failed`/`gate_failed`, **NOT** the terminal sentinel (which is wrongly `done` on failure). 010 must show "failed-as-failed-with-a-reason."
- **All phase/gate/run engine events are wire-only:** the timeline today is a fake spinner because api.ts drops `phase_started/completed/transition`, `gate_failed`, `run_completed`, `run_failed`. 008 is fundamentally about RENDERING these dropped events.
- **`gate_passed` is audit-only** (never on the wire) — a "passed gate" must be inferred from the phase advancing (`phase_transition` / next `phase_started`), not from a gate event.
- **Draft-before-ask_user** lives only in `ask_user_prompt.draft` + `messages.tool_calls.draft` — never a standalone phase output. 010's "visible draft" must render from this field.
- **Sub-agents = ghost avatars:** `sub_agent_start/done` render, but internal `tool_start/tool_end` fire on the SUB stream, invisible on the harness producer stream; batch fan-out emits N starts with no aggregate count field (count is implicit). 010's "batch sub-results" must aggregate client-side.
- **Generated files not surfaced:** `execute_code` artifacts (`final_output_files`, `workspace_file_written`, `code_execution_complete`) fire on the sub-agent's stream and are never threaded up to the harness producer stream → workflow-produced files don't appear in the panel today.

**Key files:** `backend/app/services/harness_engine.py`, `backend/app/services/harness/phase_types.py`, `backend/app/models/harness.py`, `backend/app/services/task_service.py`, `backend/app/services/agent_loop.py`, `backend/app/api/threads.py`, `frontend/src/lib/api.ts`.

---

## 2. Real Component Shapes & Constraints

### 2.1 WorkspacePanel — `frontend/src/components/panel/WorkspacePanel.tsx`
**State machine (Plan 08, nav-style 2-state):** `export type PanelState = "open" | "rail"`. The `"hidden"` state was REMOVED. The component is **CONTROLLED + dumb**; owner is `ChatLayout` (`const [panelState, setPanelState] = useState<PanelState>("open")`).
- Props: `{ selectedThread, state, onToggle, onExpand }`.
- `onToggle` flips open↔rail (open-header `PanelRightClose` button AND rail `PanelRightOpen` button both call it).
- `onExpand` force-opens (rail icons, seam pointer, mobile-sheet open).
- The grid width animation lives on **ChatLayout**, not here.

**Data flow (4 reactive hooks, all null-safe, stable EMPTY refs):**
- `const threadId = useViewingThread()` — reads `viewedThreadId`, NOT `selectedThread.id`.
- `useTodos(threadId)` → `{ data: todos }`
- `useWorkspaceFiles(threadId)` → `{ data: files }`
- `useAskUserPrompt(threadId)` → `{ data: pendingAsks }`
- (`useTasks` exists but the panel doesn't mount a Tasks section yet.)

**Body composition (stacked-accordion scroll):** outer `<div className="flex h-full flex-col overflow-y-auto">`. `PendingAskStack` pins to the very top (`pendingAsks.length > 0`, in a `border-b … p-2` wrapper). `const hasActivity = todos.length>0 || files.length>0 || pendingAsks.length>0` — empty short-circuit: `!hasActivity ? <PanelEmpty /> : (...)`. Otherwise three `<PanelSection>`s in fixed order: **Todos** (`{done, total}` count), **Files** (`files.length`), **Versions** (`defaultOpen={false}`). `selectedFile` is lifted state feeding `VersionDiff`.

**WHERE phasesByThread / the timeline slots in:** a NEW `Phases`/`Run` `<PanelSection>` (or pinned timeline above the accordion when a run is live) reads from a new `usePhases(threadId)` hook (mirror `useTodos` exactly). When a harness run is live, the phase timeline is the primary panel content; Todos/Files/Versions stay below it.

**Mobile (`<768px`, `useIsMobile()`):** bottom-sheet via shadcn `Sheet` / `SheetContent side="bottom" className="max-h-[70vh]"`. `open={state==="open"}`, `onOpenChange={(o)=> o ? onExpand() : onToggle()}`. Rail is desktop-only.

**Role/aria + surface:** `<aside role="complementary" aria-label="Agent workspace">`. Desktop surface: `border-l border-[hsl(var(--panel-border))] bg-[hsl(var(--panel-surface))]` (a distinct panel surface, NOT bg-sidebar). `state==="rail"` renders `<PanelRail>`; else `{header}{body}`.

**Sub-components:**
- `PanelSection` = real `<button aria-expanded aria-controls>` + decorative `ChevronDown` + mono count badge (only non-400 weight; `warn` → `--warning`); body is `role="region"`, `display:none` collapse.
- `PanelRail` = `w-[52px]` strip, always-present Expand button (hosts a pulsing amber dot when `pending`), then `RailIcon` for Todos/Files/Pending (each `aria-label` carries a live count).
- `PanelEmpty` = `Inbox` icon + "No workspace activity yet".
- `PendingAskCard` = amber/green/grey card with `role=radiogroup` chips + free-text + `answerAskUser(run_id, {tool_call_id, response_text, choice_index})`.

### 2.2 RunCard + ToolCallPanel (D-094-UNIFY moves these from chat INTO the panel)
**RunCard** (`memo`, whole-`message` prop) renders only for tool-bearing assistant turns. Frame: `rounded-[14px]`; streaming → `bg-primary/5 border-primary/35 shadow-[0_0_24px…]`; terminal → `bg-card/80 border-border`. **Sticky header** (`sticky top-0 z-10 backdrop-blur-md bg-popover/92`): brand-pulse `Bot` avatar (`animate-brandPulse` while streaming) + title/subtitle stack + live timer (`elapsedSeconds`, recomputed every 250ms, freezes at terminal) + `fileCount` badge + `Loader2` spinner. Header click is a **NO-OP while streaming** (D-08); terminal+tools toggles `userExpanded`. Collapse is pure-derivation: `expanded = isStreamingNow || !hasTools || userExpanded`. Collapsed row: `[Bot] Run · N tool calls · ✓ done · 1.2s ▸`. `tool-progress-bar` shimmer band under header while streaming. Body (`expanded`): optional Thinking `Collapsible` (reasoningContent) → `<ToolCallPanel>` → dashed Next-up footer.

**For Harness (010):** the answer RunCard must carry **multi-phase provenance** — instead of "N tool calls" the collapsed row is "N phases · M tool calls · K sources"; expanded body shows the phase timeline as the run record.

**ToolCallPanel** is **BODY-ONLY** (RunCard owns all chrome). Dedups by `tc.clientKey ?? tc.id ?? composite`. Interleaves tools + skills into `displayItems` sorted by `t`. **Focus-mode:** consecutive done tools before the active tool collapse to one-line `→ {summary}` rows when `hiddenStepsCount >= 3`. Per-tool: icon+color, StatusPill, `ElapsedTimer` while running, iteration dividers (`Step N+1`), `tc-active-wrap` glow + bottom shimmer for active. **execute_code is special-cased** to `TOOL_BODIES.execute_code` (Shiki editor inset via `ExecuteCodeEditorInset`, seamless preparing→running). `ToolArgsLivePanel` renders the live-args byte stream (`Generating … (X.X KB)`) for non-execute_code preparing tools.

### 2.3 StreamsProvider store model + the PANEL-06 isolation rule
**Store** (`frontend/src/stores/streamsStore.ts`, Zustand v5 + `subscribeWithSelector`):
- Chat lives in `bucketsBySurface: Map<SurfaceId, Map<threadId, Message[]>>`.
- Panel lives in **separate per-thread Maps:** `todosByThread`, `workspaceFilesByThread`, `pendingAsksByThread`, `tasksByThread`, plus `workflowLockByThread: Map<threadId, WorkflowLock>`.
- Per-thread bookkeeping: `streamingThreads:Set`, `loadingThreads:Set`, `subscriptionsByThread`, `fallbackNotices`, `reconcileErrors`.
- Every mutation is immutable `new Map(prev)`. Module-level stable EMPTY constants (`EMPTY_TODOS`, etc.) keep `useSyncExternalStore` from re-rendering on Map misses.

**Demux:** `makeStreamCallbacks` writes chat events via `setMessages` (bucket) but panel events (`onTodoUpdated`, `onWorkspaceFileWritten/Deleted`, `onAskUserPrompt/Response`, `onTaskStart/Done`, `onCapPaused`) via `useStreamsStore.getState().actions.*ForThread(threadId, …)`.

**PANEL-06 RULE (the isolation contract every sketch must respect):** chat selectors (`useThreadMessages`) read `bucketsBySurface` *exclusively*; a panel-Map mutation never changes a chat bucket ref, so **chat never re-renders on panel events**. This is the technical backbone of D-094-UNIFY: panel-driven execution legibility cannot pollute the chat transcript.

**Where the timeline store goes:** a new `phasesByThread: Map<threadId, Phase[]>` lives right beside `workflowLockByThread` in `StreamsState`, mutated only by new `*PhasesForThread` actions and a new `onPhase*` SSE handler in `makeStreamCallbacks`, with a new `usePhases(threadId)` hook mirroring `useTodos`. **Chat selectors must NEVER read `phasesByThread`** — keep it panel-only (PANEL-06 compliance).

### 2.4 The composer — `frontend/src/components/chat/MessageInput.tsx`
Bottom toolbar, left→right TODAY (up to 5 pills): **Provider** (`Layers`, only if `providers.length>1`) · **Model** (`Cpu`, `MODEL_INFO` ctx/cost meta) · **agent-mode** General/Explorer (`Compass`, `data-testid=agent-mode-selector`) · **Deep/Harness** toggle (`Workflow`, `data-testid=workflow-mode-selector`, Harness = `text-amber-400 bg-amber-400/10`) · **workflow picker** (only when `workflowMode==="harness" && !workflowLocked`, `data-testid=workflow-picker`). Right: stop button or send (`canSend = !disabled && !workflowLocked && value.trim().length>0`). Picker mount/unmount makes the row jump 4↔5 controls (layout jitter).

**cap_paused / Continue is NOT in the composer** — it's an inline card in `MessageItem.tsx` (gated `message.role==="assistant" && isLastAssistant && workflowLock?.capPaused`), amber `border-amber-400/30 bg-amber-400/10`, `continueRun(workflowLock.runId)` → `Continue ({continuesRemaining} left)` (D-06 3-cap → `continueExhausted` stop copy). After Continue, `requestProducerResubscribe(threadId, producer_run_id)` re-subscribes the fresh producer stream.

### 2.5 NavPanel — `frontend/src/components/layout/NavPanel.tsx` (so a new "Workflows" entry matches)
Fixed-width sidebar (`w-64` open / `w-16` collapsed, `localStorage("nav_panel_collapsed")`, `transition-[width] duration-300`, `bg-sidebar border-r`). `NAV_ITEMS` maps `{view, icon, label}` → `MessageSquare/FileText/Activity/Zap/Settings`. Each item: `h-10 px-2.5 rounded-lg` button + `<Icon className="w-5 h-5 shrink-0"/>` + label (`opacity-0` when collapsed; `Tooltip side="right"` when collapsed). Active = `bg-primary/15 text-primary font-medium`. **A new "Workflows" entry** = add `{ view:"workflows", icon: Workflow, label:"Workflows" }` to `NAV_ITEMS` (and `NAV_ITEMS_MOBILE`), add `"workflows"` to `ActiveView`, and a branch in ChatLayout's non-chat `<main>`.

### 2.6 ChatLayout grid + theme tokens
Grid (`activeView==="chat"`): `gridTemplateColumns: "1fr " + (panelState==="open" ? "clamp(300px,30%,420px)" : "52px")`, `motion-safe:transition-[grid-template-columns] duration-300`. Column order: NavPanel | `<main>` ChatArea (1fr) | WorkspacePanel. `⌘.`/`Ctrl+.` and `subscribeOpenPanel(expand)` live in ChatLayout.

**`.dark` "Deep Midnight" tokens the sketch theme MUST mirror** (`frontend/src/index.css`): `--background:216 45% 4%`, `--card:220 30% 7%`, `--primary:239 100% 82%` (indigo), `--accent:220 25% 14%`, `--ring:239 100% 82%`, `--success:142 71% 45%`, `--destructive:0 72% 51%`, `--warning:38 92% 60%` / `--warning-foreground:240 60% 8%`. Panel-scoped: `--panel-surface:220 40% 8%`, `--panel-border:220 25% 24%`, `--panel-muted-foreground:220 16% 65%`, `--panel-muted-foreground-dim:220 16% 70%`, `--panel-status-done:142 71% 55%`, `--panel-status-active:38 92% 62%`.

**Color language (LOCKED — use everywhere):** indigo `--primary` = normal/count · **amber `--warning` = pending / Harness / needs-you / cap_paused** · green `--success` = done · red `--destructive` = diff-base / error.

---

## 3. Real Seed-Workflow Content

Source of truth: `supabase/migrations/061_harness_seed_templates.sql` (canonical JSONB) patched by `065_harness_seed_fixes.sql` (D-09 fixes). Validated by `backend/app/models/harness.py`; graph by `backend/app/services/harness/reachability.py`. **All 4 seeds are pure linear chains with ZERO active gates post-065** — but the timeline/builder must still render gate states for authored workflows.

### 3.1 research_summarize — "Research -> Summarize" (id …b1)
*Purpose: research a question against the KB + web, then write a cited summary.*
1. `research` — `llm_agent` — tools: `search_documents`, `web_search` — no gate
2. `summarize` — `llm_single` — no tools — no gate (065 Fix-3: works the provided findings, never asks user to supply research)
Inputs at launch: `kickoff_prompt`. Graph: `research → summarize` (entry=research, terminal=summarize).

### 3.2 plan_execute_verify — "Plan -> Execute -> Verify" (id …b2)
*Purpose: draft a plan, execute it with code, then self-verify.*
1. `plan` — `llm_single` — no tools — no gate
2. `execute` — `llm_agent` — tools: `search_documents`, `execute_code` — no gate
3. `verify` — `llm_single` — no tools — **065 Fix-2 DROPPED** its original `regex_match` gate (pattern `VERIFIED`, `on_failure: retry`, `max_retries: 2`) because `verify` is terminal so a retry/skip would dead-end. Now completes on its own output.
Inputs at launch: `kickoff_prompt`. Graph: `plan → execute → verify`.

### 3.3 literature_review — "Literature review" (id …b3) — THE STORYBOARD WORKFLOW
*Purpose: split a topic into subtopics, review each in parallel, merge into one integrated review.*
1. `split` — `programmatic` — fn `split_topic` — input_keys `["topic","kickoff_prompt"]` (065 Fix-1 added `kickoff_prompt`) — no gate
2. `review` — `llm_batch_agents` — tools: `search_documents` — `max_parallel_agents: 5`, `merge_strategy: concat_numbered` — no gate
3. `merge` — `llm_single` — no tools — no gate (065 Fix-3: integrates the provided reviews)
Inputs at launch: `kickoff_prompt` (mapped to `topic`). Graph: `split → review → merge`.

### 3.4 doc_qa_human — "Doc Q&A" (id …b4)
*Purpose: draft an answer from the KB, ask the human to confirm/correct, then finalize.*
1. `draft` — `llm_agent` — tools: `search_documents` — no gate
2. `confirm` — `llm_human_input` — options `["Looks good","Needs changes"]`, timeout 300s (hard cap 1800s) — no gate
3. `finalize` — `llm_single` — no tools — no gate (065 Fix-3)
Inputs at launch: `kickoff_prompt`. Graph: `draft → confirm → finalize`.

### 3.5 STORYBOARD — literature_review on the "DBA" KB (realistic counts for sketch real content)
KB: "Fahed Mrad Chapters 1-4" (441 + 402 chunks = 843). Counts from the 093 re-UAT. **Use these exact numbers as sketch placeholder content** — they are real, not invented.

1. **Kickoff:** user submits e.g. *"Review the literature on leadership style, organizational culture, and employee engagement"*. Mode badge reads **Harness**.
2. **split phase (programmatic, instant, no AI):** `split_topic` reads `kickoff_prompt`, splits on `;`, newlines, `" and "`, `" vs "` → **4 subtopics**. Timeline row: `split → 4 subtopics`.
3. **review phase (llm_batch_agents):** **4 sub-agents spawned** in parallel (Semaphore=5 cap), each scoped to one subtopic, each running `search_documents` against the DBA folder → **~6 searches total → ~16 tool calls** across agents, hitting **~48 sources** from the 843 chunks. Each agent capped at 12 steps with force-synthesis fallback. Timeline row: `review · 4 agents spawned · 6 searches · 16 tool calls · 48 sources`.
4. **merge into review output:** the 4 results join via `concat_numbered` (`## Result 1…4`).
5. **merge phase (llm_single):** one AI call integrates + de-dupes the 4 sections into one cited review. Review-phase sources attach to the final answer (F7 union).
6. **done:** final review renders; ~48 sources surfaced.

*094 gap this fixes:* today chat shows only "Setting up agent…" then the full answer at once. The PANEL must surface these real steps LIVE, not a spinner.

### 3.6 Builder lint guarantees (read-mostly diagram, 013)
Node = phase; edge = sequential `phase_index i→i+1` PLUS any `skip_to_phase:<slug>`. After 065 all 4 seeds are linear chains, zero skip edges. Lint a builder visualizes: every non-entry node reachable (no ORPHAN), terminal reachable (NO_TERMINAL clear), contiguous `phase_index` 0..N-1 + unique slugs (BAD_INDEX clear), all skip targets exist (UNSATISFIABLE_SKIP clear), every `input_keys` satisfied by an upstream output or a known run input (`kickoff_prompt`, `topic` — INPUT_UNSATISFIED clear). All 4 seeds lint clean. **Per-phase node badges to render:** type, tool-whitelist chips, gate marker (none active post-065), and for `split` the `input_keys` it consumes.

**Key files:** `backend/app/models/harness.py`, `backend/app/services/harness/reachability.py`, `backend/app/services/harness/phase_types.py`, `backend/app/services/harness/programmatic.py`, `supabase/migrations/061_harness_seed_templates.sql`, `supabase/migrations/065_harness_seed_fixes.sql`, `.planning/phases/093-harness-cross-provider-parity/094-UI-FINDINGS-FROM-093-REUAT.md`.

---

## 4. Mode / Composer / Launch Truth

### 4.1 The two orthogonal axes (confirmed orthogonal in code)
- **Axis 1 — General/Explorer = `agent_mode`** (`"default" | "explorer"`). Client `useState` (`ChatArea.tsx`, `setAgentMode`), sent as `agentMode` per message (`useMessages.ts:108`), affects prompt assembly in `run_agent_loop`. A **per-message intent**.
- **Axis 2 — Deep/Harness = workflow-or-not** = `threads.active_workflow_run_id`. A **run-scoped commitment**, not a message option.

The two never gate each other: `agentMode` flows into the Deep `RunContext` (`threads.py:1300-1311`) and is irrelevant in the harness branch (`wf_ctx` `:1224` carries no agent_mode). **Locked decision:** *"Deep Mode" = `active_workflow_run_id IS NULL`, an umbrella over BOTH General AND Explorer.* The real model is a **2×2 {General, Explorer} × {Deep, Harness}**, but the UI today renders four adjacent identical pills inviting a "four mutually-exclusive modes" misread.

### 4.2 Server truth vs composer truth (the bug 011 must kill)
**Server truth (single source):** a thread is Harness iff `threads.active_workflow_run_id IS NOT NULL` and that run is non-terminal; otherwise Deep. Producer branch (`threads.py:1146`): `if _active_workflow_run_id is not None:` → harness engine; `else (:1300)` → byte-identical Deep `run_agent_loop`. Reconcile `GET /threads/{id}/workflow` (`:1592`, handler `:1659`) computes `mode = "harness" if active_workflow_run_id is not None else "deep"`, plus `locked` (`:1660`, anchor set AND run non-terminal) and `lock_is_stale` (`:1666`, anchor set but run missing/terminal — self-heal).

**Composer truth (separate, divergent):** the Deep/Harness pill is driven by a pure client `useState` in `ChatArea.tsx:68` — `const [workflowMode, setWorkflowMode] = useState<"deep"|"harness">("deep")`. It is NEVER fed by the server mode. The only server-derived flag the composer consumes is `workflowLocked = workflowLock !== null` (`ChatArea.tsx:83-84`), from `useWorkflowLockForThread(thread.id)` (`StreamsProvider.tsx:2132`).

**The finding #5 bug (confirmed):** on every thread switch `ChatArea.tsx:115-122` runs `setWorkflowMode("deep")` unconditionally. The mount reconcile (`:153-179`) reads true server state but only calls `setWorkflowLockForThread/clearWorkflowLockForThread` — **it never sets `workflowMode` back to `"harness"`.** So a thread mid-Harness-run renders the toggle as **"Deep"** (label `MessageInput.tsx:348`) while the lock correctly disables it (`:330-344`). Result: a locked, greyed pill reading "Deep" during a live Harness run — label and truth disagree. **011 must make this impossible.**

### 4.3 Exact composer states to design for

| State | Server condition | Current behavior |
|---|---|---|
| **idle-Deep** | anchor NULL, not streaming | textarea live; Send live; all pills clickable |
| **running** (Deep or Harness) | viewed thread streaming (`ChatArea.tsx:352 disabled={isStreaming}`) | textarea disabled; Send → Stop (`MessageInput.tsx:433-443`) |
| **locked** (Harness live) | `workflowLock !== null`, not capPaused | textarea disabled + placeholder "Workflow running — Cancel to switch back"; both toggles greyed-with-tooltip; picker hidden — **but pill still says "Deep"** (the bug) |
| **cap_paused (+Continue)** | `cap_paused=true` (`threads.py:1701`); SSE `onCapPaused` (`StreamsProvider.tsx:715-718`); `continues_remaining` from `WorkflowLock` | Continue is an out-of-band card in MessageItem (NOT composer); `continue_run` at `runs.py:667`; composer stays locked |
| **ask_user-paused** | pending ask by `tool_call_id` (`panel.py:103 /ask_user/pending`); answered via `POST /runs/{id}/ask_user_response` (`runs.py:496`) | composer is NOT the answer surface — the panel interrupt card is; composer stays locked |
| **Harness-with-no-workflow** | `workflowMode==="harness"` but `selectedWorkflowId===null` | **SILENT DEEP-SEND RISK:** `kickoffWorkflowId = (mode==="harness" && id) ? … : undefined` (`ChatArea.tsx:306`). If Harness is picked but no workflow chosen, the send goes through as a normal Deep turn with no warning. Send is not gated on the picker. **The sketch must make this impossible** (gate Send, or no launch-without-definition). |

### 4.4 D-092-UX target composer delta (Option A+C)
**Current:** up to 5 pills in one flat row (Provider/Model/General-Explorer/Deep-Harness/picker), with an icon collision (`Layers` used for both Provider and picker) and 4↔5 row jitter.

**Target:** `[ Model ▾ ]` (Provider folded INTO Model as one grouped dropdown — `MODEL_INFO` already supports grouping, zero backend change) + `[ General/Explorer ▾ ]` — a stable **2-pill composer**. **Launch moves OUT of the composer entirely:** the Deep/Harness toggle and workflow picker LEAVE; starting a workflow becomes an explicit action — primarily the **Workflows PAGE (012)**, secondarily a "Run workflow" affordance in the panel (which already owns run state, todos, files, the `ask_user` interrupt, and the amber language). Lock-UX shrinks: composer only gates textarea/Send during a run, no longer disables two extra pills. The finding #5 orphan disappears because there's no Deep/Harness pill left to mislabel — the PANEL shows real run state.

**Build delta:** (a) merge Provider into Model; (b) remove `workflowMode`/`onWorkflowModeChange`/picker props from `MessageInput`; (c) decouple `kickoffWorkflowId`-on-send into a page/panel-driven launch; (d) the General/Explorer pill stays (it's a real per-message Deep axis).

### 4.5 How a page-based launch sets `active_workflow_run_id`
**Today there is NO launch primitive except send-with-kickoff.** The kickoff chain lives in `POST /threads/{id}/messages` (`threads.py:766`): reads `body.workflow_definition_id` → RLS-resolves + `model_validate`s the published definition (`:819-847`) → inserts user message → creates producer `runs` row → calls `create_workflow_run(...)` (`:988`) which atomically sets `threads.active_workflow_run_id` and seeds `inputs={"kickoff_prompt": body.content}` (SEED-047) → producer branches Harness. Published-list feed: `GET /workflows/published` (`workflows.py:38`). There is NO standalone `POST /workflows/{id}/run` and no inputs-form endpoint yet.

**Workflows-page launch (012) — two viable shapes:**
- **Reuse the existing path (lowest cost):** create/open a thread → `POST /threads/{id}/messages` with `workflow_definition_id` set and `content` = collected kickoff prompt → redirect into that thread (panel/run already streaming). This is the only proven end-to-end path.
- **New thin endpoint (cleaner, for a future inputs form):** `POST /workflows/{id}/run` that creates a thread, calls `create_workflow_run` directly with structured `inputs`, returns the thread id to redirect to. Small net-new lift of the `:819-1002` block.

**Constraint (locked):** workflows are **a mode of a thread, not a separate page/route** — even the Workflows PAGE must hand off INTO a thread (create/open + redirect), never run page-resident. `continue_run` (`runs.py:667`) is resume-only, NOT a launch path.

**Key files:** `backend/app/api/threads.py` (`:766`/`:1146`/`:1592`/`:1660`/`:1701`), `backend/app/api/runs.py` (`:496`/`:667`), `backend/app/api/workflows.py:38`, `frontend/src/components/chat/MessageInput.tsx`, `frontend/src/components/chat/ChatArea.tsx:68/83/120/306`, `frontend/src/providers/StreamsProvider.tsx:715/1214/2132`, `frontend/src/stores/streamsStore.ts:51`, `frontend/src/hooks/useMessages.ts:55/108`.

---

## 5. Competitive Patterns to Steal

### 5.1 Live agent-run visualization (008 timeline, 010 honesty)
Best moves:
1. **Persistent plan/to-do that doubles as a progress bar** (Devin Interactive Planning, Manus enumerated Plan events, Lovable plan-before-code). The visible ordered plan is the contract you watch fulfilled — turns a wall of activity into bounded, finite progress.
2. **Live plain-language narration of the CURRENT action + intent** (OpenAI ChatGPT agent: "Browsing website X for information…", "Running script to analyze data…"). Names tool AND intent in one sentence — the single biggest spinner-killer.
3. **Split layout: steps on one side, live artifact on the other** (v0, Claude artifacts side panel, Devin/Cowork right sidebar). Seeing output take shape beats any progress text.
4. **Real honest counters, not fake percentages** (GitHub Copilot session log: status, tokens, session count/length, changed-files summary). Show N steps done, M tools called, K sources — never "73%".
5. **Collapse/focus for long runs + replayable timeline** (Cursor Compact mode: hides tool icons, collapses diffs; Devin full replay timeline + Session Insights). Stream the now compactly, keep every step inspectable on demand.
6. **Distinct completion (reviewable diff) + distinct failure (intervention)** (Copilot summary+PR; ChatGPT agent pauses for irreversible actions; Operator/Cowork takeover mid-run). Failure = graceful pause, not silent stall.

Anti-patterns: undifferentiated spinner / "Thinking…" with no current-action text · fake/monotonic progress bars · log-dump as the default surface (raw logs are a drill-down only) · **silent failure / infinite stall** (cardinal sin) · no persistence (run vanishes on collapse/refresh).

### 5.2 Pipeline/DAG run visualization (008 ordered+gated+fan-out)
Best moves:
1. **Vertical span timeline with outcome-colored bars** (Temporal Timeline View, Inngest waterfall). For an ordered locked pipeline, a vertical stepper where each phase is a bar colored by outcome reads instantly + shows ordering top-to-bottom.
2. **3+ state legend, not 2** (Airflow Grid legend: green=success, red=failed, yellow=running, gray=queued, purple=up_for_retry). Done/current/pending is insufficient — need at least: completed (green) · running (animated amber) · **pending/locked-ahead (gray, visibly dimmed/inert)** · failed (red) · retrying (purple, "Attempt N"). Locked-ahead phases render gray+inert so the lock is legible.
3. **Gate = its own node with pass/fail/stopped state, cascading downstream** (Zapier Zap History: Success/Filtered/Stopped/Error/Held; a filter that doesn't pass marks that step AND all downstream "Filtered" with the explicit reason). Gold standard for "a gate stopped the run, here's exactly which gate and why."
4. **Retry = stacked attempt spans with "Attempt N" badge** (Inngest — each attempt its own span). Don't overwrite the failed attempt — show retry history. (Maps to our `gate_failed{attempt}` per-attempt emission.)
5. **Fan-out = parent span with nested collapsible child spans, parallel children sharing a time band** (Inngest waterfall, Prefect radar hierarchy, Temporal parallel rows). Sub-agents nest under their parent phase as indented child rows; each carries its own state so one failed sub-agent is visible without expanding everything.

Failed-with-a-reason (our RC-4): **auto-expand + annotation** (GitHub surfaces the error at the top of the run AND inline at the failing step, no click) · **distinct failure taxonomy** (Prefect Failed vs Crashed; Zapier Filtered vs Stopped vs Error — an empty render = several reasons collapsed into one missing state; give the failing phase a typed reason) · **persist progress so mid-run state isn't lost** (n8n "Save Execution Progress" — RC-4 resembles n8n's default where the run object discards per-phase data on abort). **Sketch rule:** if `error` is empty, render an explicit "Failure reason not captured" sentinel — never an empty card.

### 5.3 NL workflow builders (013 — AI builds, human observes/approves)
Best moves:
1. **Read-mostly diagram = streamed phase cards, NOT an editable graph** (n8n "Monitor" phase — real-time feedback as the diagram materializes; Lindy "series of connected steps"). Each AI-proposed phase animates in as the model emits it. Nodes are **inspectable, not draggable** — click opens a side detail/form, never a free-canvas drag handle. The diagram is a transcript of the AI's reasoning, not a workbench.
2. **One persistent talk-to-edit rail** (Lindy Agent Builder: "type a message describing what you want to change… automatically add the necessary steps", explicitly NO dragging; Dust Sidekick: "describe what you want… Sidekick drafts instructions, recommends tools and skills"). Chat pane beside the diagram; every refinement = "type what to change" → diagram re-renders. Only direct manipulation = form-tweak inside a node + approve/reject chips per phase.
3. **Inferred-inputs review strip, surfaced not buried** (Gumloop auto-creates steps + data mapping; n8n surfaces "required credentials and parameters" for review). A dedicated "Inputs & assets the AI inferred" panel: detected fields, KB sources it grounded on, uploaded templates it attached — each with approve/edit. The human's primary approval surface.
4. **Explicit publish→lock with versioning, diagram-as-living-documentation** (OpenAI Agent Builder: "When you publish, it becomes an object with an ID and versioning"; Zapier Canvas: diagram "always matches your implementation"; Stack AI: explicit Publish gate). One Publish button freezes into an immutable, ID'd, versioned object; edits fork a new draft version rather than mutating the locked one (matches our "locked-on-publish" rule). Anthropic Agent Skills (no canvas, just SKILL.md) validates the diagram is optional value-add, not the source of truth.

Anti-pattern (operator explicitly rejects): **the drag-canvas dead-middle** (Flowise/Stack AI/Respell blank-canvas-drag-nodes-wire-arrows). Documented failure mode: "the visual canvas can feel overwhelming for simple automations", "if you just want to connect two apps, the full visual canvas is overkill", drag builders "require manually connecting steps, handling failure paths, and maintaining visual flowcharts." 013 is explicitly NOT this — no connect-the-dots gesture exists in the UI.

---

## 6. A11y Spec — WCAG 2.1 AA (timeline + RunCard)

### 6.1 The live-region decision (feed vs log vs status)
Our timeline is a **finite, ordered set of structured phase cards that update in place** (queued → running → done/failed), not infinite-scroll and not append-only.
- **Do NOT use `role="feed"`** (it's for infinite-scroll articles; our count is bounded/known upfront).
- **Do NOT make the whole timeline `role="log"`** (log re-announces every appended node → token streaming floods AT). Log is right only for append-only surfaces (raw stdout / chat transcript).
- **DO use a dedicated visually-hidden `role="status"` (`aria-live="polite"`, implicit `aria-atomic="true"`) "announcer"** that we imperatively write *milestone* sentences into. This decouples what's rendered (high-frequency, silent to AT) from what's announced (low-frequency, polite). **This silent-region + separate-announcer split is the core pattern.**

### 6.2 Structure & roles
```
<section aria-label="Workflow run timeline">     ← landmark
  <ol aria-label="Phases">                       ← ordered list = sequence/position semantics
    <li> phase card 1 (accordion item) </li> …
  </ol>
</section>
<div role="status" aria-live="polite" class="sr-only"></div>  ← announcer (sibling, present at load)
```
- [ ] Timeline wrapper = `<section>` + `aria-label`. RunCard root gets its own `aria-label` (e.g. "Harness run, status: running").
- [ ] Phases = `<ol>`/`<li>` so AT exposes order + position ("3 of 5") natively (no manual `aria-setsize`/`aria-posinset`).
- [ ] The `role="status"` announcer exists **at page load** (live regions must exist before updates, or the first injection is missed). One announcer per RunCard.

### 6.3 Each phase card = accordion item (APG Accordion)
- [ ] Header = `<h3>` (or `aria-level` matching IA) wrapping a single `<button>` (button is the heading's only child).
- [ ] Button: `aria-expanded="true|false"` + `aria-controls="<panel-id>"`.
- [ ] Panel: `id`, `role="region"`, `aria-labelledby="<button-id>"`; hidden via `hidden`/`display:none` when collapsed (not just visually).
- [ ] Forced-open active phase: set `aria-disabled="true"` on its button rather than removing it.

**Keyboard:** `Tab`/`Shift+Tab` move between header buttons + focusables inside open panels · `Enter`/`Space` toggle · (recommended) `↑`/`↓` move between headers, `Home`/`End` jump first/last · visible focus ring ≥3:1 vs card bg (2.4.7 + 1.4.11).

### 6.4 Streaming progress without flooding
1. **Per-phase progressbar = visual + value, NOT a live region.** `role="progressbar"` with `aria-valuenow/min/max` (determinate) OR omit `aria-valuenow` for indeterminate ("Running…"); give it `aria-label`/`aria-labelledby`. The progressbar itself must NOT be a live region (value churns too fast). Set `aria-busy="true"` on the phase panel being populated, flip to `false` on completion. Don't announce every percent tick — throttle to coarse milestones (25/50/75/100%) via the announcer, debounced ≥~5s.
2. **Announce transitions, not tokens.** Write to `role="status"` ONLY on state edges, plain language: phase start "Phase 2 of 5, Research, started." · phase done "Research complete. Summarize started." · run end "Workflow complete, 5 of 5 phases succeeded." · **on failure use a SEPARATE `role="alert"` (assertive)**: "Phase 3, Execute, failed." Coalesce edges <1s apart into one sentence. Streaming answer body renders in a container with NO live role (silent to AT) but `aria-busy="true"` while streaming. Raw stdout, if shown opt-in, is the ONE place `role="log"` (polite) is appropriate.

### 6.5 Focus management
- [ ] Live updates must NOT steal focus — never `.focus()` streamed content.
- [ ] Auto-expanding the active phase during streaming: announce only, do NOT move focus (2.4.3/3.2.x trap).
- [ ] `ask_user` interrupt is the EXCEPTION: move focus to the prompt + fire `role="alert"` (user-requested input context).
- [ ] On RunCard unmount/collapse, return focus to the trigger that opened it.

### 6.6 Non-color status (SC 1.4.1) — icon + text + shape, never color alone
- [ ] Queued: hollow circle ○ + "Queued" · Running: spinner/pulse + "Running" + progressbar · Done: filled check ✓ + "Complete" · Failed: X / △! + "Failed" · (Locked-ahead: dimmed dash/lock + "Locked" · Retrying: ↻ + "Attempt N").
- [ ] Status text is real text (or `aria-label`/visually-hidden text on icon-only badges) — color is decorative reinforcement only.
- [ ] State icons meet non-text contrast ≥3:1 vs adjacent bg (1.4.11) in BOTH themes.

### 6.7 Contrast (1.4.3 / 1.4.11) — both themes
- [ ] Status text, phase titles, timestamps: ≥4.5:1 (≥3:1 only if ≥18.66px bold / 24px). Verify "Deep Midnight" muted greys — secondary/timestamp text is the usual failure.
- [ ] Status/state icons, card borders, focus rings, progressbar track-vs-fill: ≥3:1 (non-text).
- [ ] In dark theme, success-green/error-red often drop below 4.5:1 on dark surfaces — lighten the *text* token, don't rely on badge fill. Test fill-vs-icon and icon-vs-card-bg pairs.

### 6.8 Test gate
- [ ] vitest-axe on RunCard in each state (queued/running/done/failed) + timeline with 1 and N phases — zero violations.
- [ ] Unit tests for: announcer receives exactly one message per transition (no per-token spam), `aria-expanded` toggles, `aria-busy` flips on stream end, keyboard toggle/arrow nav. (axe can't verify announce-throttling or focus-no-steal — assert manually.)

---

## 7. Per-Sketch Design Implications

### 008 phase-timeline (live harness run in panel — the #1 acceptance bar)
**Must honor:**
- Render the DROPPED wire-only events: `phase_started`/`phase_completed`/`phase_transition` drive the row states; `gate_failed{attempt}` drives a per-attempt retry sub-row. This IS the spinner-killer — no more "Setting up agent…".
- 5-state legend with a REAL locked-ahead state: completed (green ✓) · running (amber pulse + progressbar) · locked-ahead (gray, dimmed, inert) · failed (red, reason-bearing) · retrying (purple ↻ "Attempt N"). Color = LOCKED language; never color alone (§6.6).
- Vertical span/stepper, top-to-bottom = phase order; honest header counts (`Phase 3/5 · 16 tool calls · 48 sources`), NEVER a fake percent.
- Plain-language "doing now" line above the timeline (ChatGPT-agent narration).
- Fan-out (`review`): sub-agents nest as collapsible indented child rows under the parent phase, parallel children sharing a time band; each child has its own state (ghost-avatar today → real child rows).
- `gate_passed` is NOT on the wire — infer "passed" from the phase advancing, never from a gate event.

**Should explore:** focus-mode collapse of completed phases on long runs (Cursor Compact); the timeline persisting as a replayable record after `done`; an aggregate sub-agent count chip (client-derived, since no aggregate field exists).

**Watch out for:** sub-agent internal `tool_start/tool_end` fire on the SUB stream, NOT the harness producer stream — don't promise live tool drill-down inside a phase unless the sketch also proposes threading those up. Generated files don't reach the harness stream today. Live-region flooding (§6.4 — announce transitions, not tokens).

### 009 unified-surface (D-094-UNIFY)
**Must honor:**
- One execution surface (the panel) driven by two modes; chat keeps ONLY prompt + final answer + a quiet "ran in workspace ▸" pointer that `onExpand`s the panel.
- PANEL-06: panel events never re-render chat (`phasesByThread` is panel-only, never read by chat selectors). The "ran in workspace ▸" pointer is a static chat element, not a live mirror.
- Both Deep tool-runs AND Harness phase-runs live in the panel via RunCard/ToolCallPanel relocated from chat; the panel's `open|rail` + mobile-sheet model (§2.1) governs both.
- The seam pointer uses `onExpand` (force-open), matching the existing seam-pointer affordance.

**Should explore:** how a collapsed/rail panel signals a live run (the existing rail amber-dot pattern); whether the chat "ran in workspace" pointer shows a one-line outcome summary (phases/sources/time) like Copilot's summary.

**Watch out for:** don't duplicate the answer in both chat and panel — chat shows the FINAL answer (prose), the panel shows the RUN RECORD (provenance). Keep amber strictly = Harness/pending/needs-you.

### 010 honesty-and-drafts
**Must honor:**
- RC-4: failure must render as FAILED-WITH-A-REASON, keyed off `run_failed`/`gate_failed` — NOT the terminal sentinel (which is wrongly `done`). Empty `error` → explicit "Failure reason not captured" sentinel, never an empty card.
- Visible draft-before-ask_user: render the `ask_user_prompt.draft` field as a reviewable draft ABOVE the question chips (the only place the draft exists).
- Batch sub-results: aggregate the 4 `sub_agent_done.summary` values into a readable per-subtopic result list (client-side; no aggregate field) before the merge phase.
- Harness answer RunCard with multi-phase provenance: collapsed row "N phases · M tool calls · K sources"; expanded body = the phase timeline as the run record.
- Auto-expand the failing phase + surface the gate/tool name inline (GitHub annotation model).

**Should explore:** distinct failure taxonomy beyond one red state (gate-failed vs wall-clock-timeout vs run-failed); a per-attempt retry history (Inngest "Attempt N").

**Watch out for:** the draft is persisted in `messages.tool_calls.draft` — make sure the sketch shows it as a draft, not as a final answer. ask_user answer surface is the panel interrupt card, never the composer.

### 011 mode-and-composer
**Must honor:**
- Kill the finding-#5 bug: no "Deep" label on a thread mid-Harness-run. Target = a 2-pill composer `[Model ▾][General/Explorer ▾]` with NO Deep/Harness toggle and NO workflow picker (launch moved out).
- Provider folded INTO Model (one grouped dropdown). General/Explorer pill STAYS (a real per-message Deep axis).
- Render the 2×2 axes correctly: General/Explorer (`agent_mode`, per-message) ⟂ Deep/Harness (`active_workflow_run_id`, run-scoped) — never as four mutually-exclusive pills.
- Locked state: composer only gates textarea/Send during a run (no more two-extra-greyed-pills); placeholder reflects the live run; the PANEL shows real run state.
- The cap_paused Continue card stays in MessageItem (amber, `Continue (N left)`), NOT the composer.

**Should explore:** how mode is COMMUNICATED once the toggle is gone (a quiet run-status indicator near the composer or in the panel header reading "Harness · literature_review running"); the Harness-with-no-workflow silent-Deep-send risk is designed out entirely (no picker = no orphan launch).

**Watch out for:** General/Explorer is only meaningful in Deep (irrelevant in harness branch) — don't imply it controls a running workflow.

### 012 workflows-page (library + launcher — BUILD NOW)
**Must honor:**
- Renders existing `workflow_definitions` via `GET /workflows/published` (the 4 real seeds, §3 — use real titles/purposes/phase chains).
- Each card: title, purpose, ordered phase chain with type badges + tool-whitelist chips + the `input_keys` the entry phase needs (`kickoff_prompt`, `topic`).
- Run → creates/opens a thread, hands off the kickoff prompt + definition id INTO the thread, redirects (the panel/run is already streaming). Workflows are a MODE OF A THREAD, never page-resident.
- This kills the composer dropdown (012 + 011 are the same launch-relocation move).
- A new NavPanel "Workflows" entry (`icon: Workflow`) matching the §2.5 item shape.

**Should explore:** an inputs/kickoff-prompt form on Run (today only `kickoff_prompt` is collected; a thin `POST /workflows/{id}/run` could carry structured inputs later); diagram-as-living-documentation per card (Zapier Canvas).

**Watch out for:** there is NO standalone run endpoint yet — the lowest-cost launch reuses `POST /threads/{id}/messages` with `workflow_definition_id`. `continue_run` is resume-only, not a launch path. Gate Run so it can't launch without a definition.

### 013 workflow-builder (NL authoring — DESIGN NOW, BUILD v2.9)
**Must honor:**
- Read-mostly LIVE diagram: AI-proposed phases stream in as vertical cards (n8n "Monitor" / Lindy "connected steps"). Nodes are inspectable, NOT draggable — click opens a side form. NO connect-the-dots gesture anywhere (the rejected drag-canvas dead-middle).
- describe→refine→publish via a persistent talk-to-edit rail (Lindy/Dust Sidekick): every change is typed, diagram re-renders; only direct manipulation = node form-tweak + approve/reject chips.
- HITL inferred-inputs review strip: detected fields, KB sources grounded on, uploaded templates attached — each approve/edit (Gumloop + n8n).
- Publish→lock with versioning (OpenAI Agent Builder); edits fork a new draft, never mutate the locked object.
- Node badges must match the real model: phase type (one of the 5), tool-whitelist chips, gate marker, `input_keys` consumed — and render lint state (ORPHAN/NO_TERMINAL/BAD_INDEX/UNSATISFIABLE_SKIP/INPUT_UNSATISFIED clear, per §3.6).

**Should explore:** diagram-as-documentation post-publish (Zapier Canvas); showing the reachability graph (linear chain + any skip edges) live as the AI proposes phases.

**Watch out for:** the 5 real phase types + the ValidatorSpec gate vocabulary are the ONLY building blocks — don't invent node types. Workflows still hand off into a thread to RUN; the builder authors the definition, it doesn't execute. KB-grounding (the upload-templates step) is the grounding source, mirroring Dust "connect your documentation."
