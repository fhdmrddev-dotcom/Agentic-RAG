# Phase 094 — DATA-CONTRACT.md

**The authoritative handover that lets the build render REAL workflow data — never invented, never messy — for ANY published business workflow.**

This document is the binding contract between the panel UI (sketches 008–013) and the runtime. It supersedes the storyboard numbers in the sketches. Every datum the UI shows MUST trace to one of three sources named here, or it is flagged INVENTED and suppressed/replaced before build.

> Companion: `BRIEF.md` (same folder) carries the sketch storyboards and §-references cited below. This file is the field-level grounding layer.

---

## 1. PRINCIPLE

**The UI binds only to the generic runtime vocabulary. Sketch content is sample fixture data. Any workflow = N phases, each one of exactly 5 phase types, each emitting the same shared events.**

Three rules, stated crisply:

1. **No workflow content in the renderer.** The UI NEVER keys on `literature_review`, `DBA`, `Fahed Mrad`, `48 sources`, `4 subtopics`, `Leadership style`. Those are SAMPLE FIXTURE DATA from `BRIEF.md` §3.5. The contract is "any workflow is N phases of 5 types emitting one shared event vocabulary." A new published `WorkflowDefinition` renders correctly because its phases MUST be one of 5 literals (the discriminated union is `extra='forbid'`-locked in `backend/app/models/harness.py:90-99`).

2. **The discriminator is the wire field, not inferred content.** The timeline renders one of 5 canonical shapes per phase, keyed on **`phase_started.phase_type`** (the SSE field emitted at `harness_engine.py:680`) — never inferred from the phase's prose or slug.

3. **Three sources own disjoint fields; where they overlap, reconcile is the floor and live advances forward.** STATIC (definition / authoring time), LIVE (SSE events), RECONCILE (mount fetch). The single anti-drift rule (D-v2.5-03): SSE is a best-effort hint, NOT source of truth; on mount call the reconcile fetch first, then let live events mutate forward. **Live never moves a counter backward.**

A value renders ONLY if it resolves to (a) a field on the resolved `WorkflowDefinition`, (b) a real tally of received SSE events, or (c) a reconcile field. Anything else is INVENTED (§8) and is suppressed, not faked.

---

## 2. PHASE-TYPE RENDER CONTRACT (the backbone — 5 shapes)

A workflow's phases are a discriminated union on `config.phase_type`. The literal set is LOCKED (`backend/app/models/harness.py:90-99`, verified: `Annotated[Union[...], Field(discriminator="phase_type")]`). Each phase renders exactly ONE canonical shape. **Per-phase return dicts are NOT emitted on the harness producer stream today** — only `phase_started` / `phase_completed` / `phase_transition` carry phase identity on the wire. The rich return fields (`text`, `sub_run_id`, `source_refs`, `sub_questions`, `answer`, `draft`) are persisted-only or surfaced via OTHER events (sub-agent bookends, `ask_user_prompt`, the end-of-run `sources`/`citations`/`confidence` union). The table therefore states, per type, WHICH datum has a live wire source vs. derived/persisted/INVENTED-if-shown.

| Phase type | Static config (authoring) | Return dict (executor) | Live wire signal | Canonical render shape | What's NOT on the wire (suppress / flag) |
|---|---|---|---|---|---|
| **`programmatic`** | `{phase_type, fn:str, input_keys:list[str]}` (`harness.py:33-39`) | `_exec_programmatic` (`phase_types.py:201`) returns the fn's dict; only registered fn `split_topic` → `{"sub_questions":[str,...]}` (`programmatic.py:116`) | `phase_started{phase,phase_index,phase_type}` → `phase_completed{phase,phase_index}` only | Single compact row. Glyph = gear/function. Label "Server step", title = slug, subtitle "Ran instantly, no AI." Count chip ONLY if a list is on the wire. | The return dict is NOT on the producer stream → no `sub_questions` count today. "N sub-topics" = INVENTED unless §9-A1 closes. Renderer MUST NOT assume `sub_questions` (that is `split_topic`-specific). |
| **`llm_single`** | `{phase_type, prompt:str, model?, temperature?}` (`harness.py:42-48`) | `_exec_llm_single` (`phase_types.py:234`) returns `{"text":str}` (line 252) | `phase_started` → `phase_completed` | Single row, glyph = pen. Label "AI write step", title = slug. Subtitle = "doing now" narration while running. No count chip. Running = amber pulse + indeterminate progressbar; done = green check. | `text` is NOT individually on the wire. Only the FINAL phase's `text` becomes `ctx.final_output` and reaches chat as the assistant message (engine final-answer path). Per-phase body prose in the timeline = INVENTED. "1 call" = no source. |
| **`llm_agent`** | `{phase_type, prompt, available_tools:list[str], max_steps=12, wall_clock_seconds?, model?}` (`harness.py:50-61`) | `_exec_llm_agent` (`phase_types.py:255`) returns `{"text","sub_run_id":str,"source_refs":list,"citations":list,"similarity_scores":list}` (line 311) | `sub_agent_start{sub_run_id,description,tools,max_steps}` (`task_service.py:575`) → `sub_agent_done{sub_run_id,status,summary}` (`:877`) on the PRODUCER stream | Parent phase row + ONE nested child row (the sub-agent). Glyph = robot. Tool-whitelist chips from STATIC `available_tools`. Child row: `description` (the task), live state start→done, `summary` on done. | Sub-agent's internal `tool_start`/`tool_end` fire on `run:{sub_run_id}` (a DIFFERENT stream) — invisible on the producer. Per-phase "N tool calls / K sources" = INVENTED unless §9-B threads sub-stream events up. `summary` is the only real per-phase result text on the wire. |
| **`llm_batch_agents`** | `{phase_type, prompt, available_tools, max_steps=12, max_parallel_agents=5, merge_strategy:"concat"\|"concat_numbered", wall_clock_seconds?, model?}` (`harness.py:64-77`) | `_exec_llm_batch_agents` (`phase_types.py:320`) returns `{"text"(merged),"sub_run_ids":[str,...],"source_refs","citations","similarity_scores"}` (line 398) | Each fan-out branch emits its OWN `sub_agent_start`/`sub_agent_done` on the producer stream. N = `len(sub_questions)` from upstream programmatic phase (`_collect_sub_questions`, `phase_types.py:506`; falls back to `[prompt]` → 1 if none) | Parent row + N nested collapsible child rows sharing ONE time band (parallel). Glyph = robots/fan-out. Each child = its sub-question `description`, live start→done, `summary`. | **NO aggregate "N agents" field on the wire.** `agentsSpawned` = client tally of `sub_agent_start` for this parent phase — NEVER static, NEVER hardcoded. "6 searches / 16 tool calls / 48 sources" per-phase = INVENTED (sub-stream / end-of-run only). |
| **`llm_human_input`** | `{phase_type, prompt:str, options:list[str]=[], timeout_seconds:int=300}` (`harness.py:80-87`; hard cap 1800s, `phase_types.py:421` / `Settings.ask_user_max_timeout_seconds`) | `_exec_llm_human_input` (`phase_types.py:407`) returns `{"text":prompt,"answer":str,"tool_call_id":str}` (line 503) | **`ask_user_prompt{tool_call_id,prompt,options,timeout_seconds,draft}`** on the producer stream (`phase_types.py:482-489`); blocks; answer = **`ask_user_response{tool_call_id,...}`** (api.ts:600-612 reads `tool_call_id` + `draft`) | Phase row → PAUSED (amber, "needs you"). Panel surfaces existing `PendingAskCard` (`role=radiogroup` chips + free-text). `draft` renders ABOVE the question, labelled DRAFT (not a final answer). On answer, ask clears + phase advances. | `draft` is the ONLY place the prior-phase text exists on the wire — `_latest_phase_text(accumulated_outputs)` (`phase_types.py:429`, additive D-12; older rows have no draft). Same vocabulary as Deep ask_user → already lands in `pendingAsksByThread`. |

**There is NO `code_exec` phase type.** `execute_code` is a TOOL inside an `llm_agent`/`llm_batch_agents` whitelist; it renders via existing `code_execution_*` events on the SUB stream, never as a phase.

**UNKNOWN phase_type:** if `phase_started.phase_type` is not one of the 5 (forward-compat), fall back to a generic row (`PHASE_TYPE_LABEL[unknown] ?? "Step"`, neutral glyph, status only). Never crash on an unrecognized discriminator.

**`programmatic` GENERALIZATION (H2):** a `programmatic` phase ALWAYS renders as a bare server-step row (label + done), **regardless of its `fn`**. NO programmatic fn's return dict reaches the producer stream, so `split_topic`'s `sub_questions` is **not special — it is equally absent**, exactly like a future `score_risk`→`{score}` or `route`→`{path}` fn. So no programmatic phase shows a count today; §9-A1 would unlock counts for ALL programmatic fns uniformly (never just split_topic). The renderer must NOT special-case `sub_questions`.

---

## 3. SOURCE-OF-TRUTH & WHERE-TO-MAP

Three sources, three lifecycles. The invariant: **STATIC, LIVE, and RECONCILE own DISJOINT fields; where they overlap, RECONCILE wins on mount and LIVE wins thereafter; the timeline NEVER reads a value not traceable to one of these three.**

### (a) STATIC structure — from the `WorkflowDefinition`

- **Source:** `GET /workflows/published` → `PublishedWorkflow{id, slug, name}` (`workflows.py:28-38`) for the library/launcher (012). The FULL `definition` JSONB (parsed by `WorkflowDefinition` / `PhaseSpec`, `harness.py:111-124`) for per-phase static fields.
- **GAP:** there is currently **no GET that returns the full parsed definition to the client.** The published-list endpoint returns ONLY `{id, slug, name}`. So per-phase chips (phase types, tool-whitelist chips, input_keys, gate markers) in 012/013 have **no client data source today** → require a new thin endpoint (`GET /workflows/{id}` returning `definition.phases`, or a widened `/published`). See §9.
- **Owns (never changes during a run):** phase `slug`, `phase_index`, `phase_type`, `config.available_tools` (tool chips), `config.input_keys`, `validators` (gate markers, `ValidatorSpec`), `merge_strategy`, `max_parallel_agents`, definition `name`/`slug`/`version`/`status`.

### (b) LIVE state — the single SSE normalizer

- **Source:** the `run:{run_id}` Redis stream, parsed by the ONE consumer in `frontend/src/lib/api.ts` (`subscribeToRun`, the switch at lines 485-667), dispatched to callbacks from `makeStreamCallbacks`, which write panel state via `useStreamsStore.getState().actions.*ForThread(threadId, …)` (streamsStore demux convention).
- **THE NEW NORMALIZER (must be added):** api.ts has **NO branch** for `phase_started`, `phase_completed`, `phase_transition`, `gate_failed`, `run_completed`, `run_failed` — verified: the switch jumps from `sub_agent_start` (511) past `sources`/`citations` (566-569) to `ask_user_prompt` (600) with no phase branches. They are **wire-emitted but silently dropped** today. The contract: add exactly these branches, each calling a new `onPhase*` callback that mutates a new **`phasesByThread: Map<threadId, Phase[]>`** store slice (sits beside `workflowLockByThread`) via new `*PhasesForThread` actions. This is the SINGLE place a wire event becomes panel state.
- **The normalized `Phase` shape (per element):**
  - `slug` — from `phase_started.phase`
  - `phaseIndex` — from `phase_started.phase_index`
  - `phaseType` — from `phase_started.phase_type` (the discriminator §2 keys on)
  - `status` — `"running"` on `phase_started`; `"done"` on `phase_completed`; `"failed"` on `run_failed` / terminal `gate_failed`; `"retrying"` on non-terminal `gate_failed`; `"skipped"` on `phase_transition.via === "skip_to_phase"`; `"pending"` for not-yet-started phases (derived from `total_phases`, see RECONCILE)
  - `attempt` — from `gate_failed.attempt` (accumulates per-attempt rows)
  - `error` — from `gate_failed.error` / `run_failed.reason`
  - `subAgents: SubAgentRow[]` — built from `sub_agent_start`/`sub_agent_done` (existing `tasksByThread` shape, keyed by `sub_run_id`: `{sub_run_id, description, tools, max_steps, status, summary}`), associated with the currently-running phase
  - `pendingAsk` — POINTER into existing `pendingAsksByThread` by `tool_call_id` (do NOT duplicate; the ask card already has a store)
- **Owns:** `status`, `attempt`, `error`, child sub-agent rows, the live "doing now" narration.
- **PANEL-06 isolation:** `phasesByThread` is panel-only; **chat selectors must NEVER read it.** Chat-side pointers/receipts read `workflowLockByThread` (presence) only and must NOT re-render on phase events.

### (c) RECONCILE truth — on mount

- **Source:** `GET /threads/{id}/workflow` → `ThreadWorkflowState` (`models/thread.py:48-85`, `threads.py:1659`): `{thread_id, mode:"deep"|"harness", locked, active_workflow_run_id, run_status, definition_slug, definition_name, current_phase_slug, current_phase_index, total_phases, lock_is_stale, cap_paused, continues_used, continues_remaining, latest_producer_run_id}`.
- **Owns the run-level frame the LIVE stream can't reconstruct from scratch:** `definition_name` (timeline header title), `current_phase_index` + `total_phases` (the honest "Phase 3 / 5" counter — REAL, `thread.py:69-70`), `run_status`, `mode`, `cap_paused`/`continues_remaining` (Continue card), `lock_is_stale` (self-heal), `latest_producer_run_id` (re-attach the live stream with no page action).

### THE SINGLE ANTI-DRIFT RULE (D-v2.5-03)

Realtime/SSE is a best-effort hint, NOT source of truth. On every mount/reconnect:

1. Call `GET /threads/{id}/workflow` to seed `total_phases`, `current_phase_index`, `mode`, lock, Continue budget.
2. If `latest_producer_run_id` is set, re-subscribe `GET /runs/{id}/stream` to replay+resume LIVE phase events.
3. Thereafter LIVE events mutate `phasesByThread`. "Pending" phases (not yet started) are derived as `total_phases − (phases seen live)`.

**`current_phase_index/total_phases` from reconcile is the AUTHORITATIVE counter** — a reconnect mid-run shows "Phase 3 / 5" before any live event arrives. **If reconcile and live disagree, reconcile is the floor (durable DB state) and live advances it forward — live NEVER moves the counter backward.** This is the single rule that prevents inconsistency.

---

## 4. THE PAYLOAD MATRIX (per sketch, generic)

Duplicates merged across sketches; sample values stripped. Columns: UI element · generic field · source event/endpoint · store · empty/loading/failed · any-workflow note. Failure events are wire-only today (need §3(b) branches).

### 4.1 — Cross-cutting (appears in 008/009/010/011/012)

| UI element | Generic field | Source | Store | Empty / loading / failed | Any-workflow note |
|---|---|---|---|---|---|
| Mode badge (Harness / Deep) | `mode` = `active_workflow_run_id IS NOT NULL && run non-terminal ? "harness" : "deep"` | `GET /threads/{id}/workflow.mode` (`threads.py:1659`); engine emits NO `mode` event | `workflowLockByThread` (presence ⇒ harness) via `useWorkflowLockForThread` | empty: no lock ⇒ Deep, no Harness badge; loading: neutral (not amber) until reconcile; failed: fall back to Deep + reconcile-error banner | 2-value server fact for EVERY workflow; never a client `workflowMode` useState (this kills finding #5). |
| Workflow name | `definition_name` | `GET /threads/{id}/workflow.definition_name` OR `GET /workflows/published.name` | derived (no Map field today — add `workflowMetaByThread` or extend `WorkflowLock`) | empty: "Workflow" / slug; loading: skeleton; failed: omit name, keep badge | Reads the generic name string for whatever ran; never hardcoded. |
| Phase progress chip "Phase i / N" | `current_phase_index + 1` / `total_phases` | reconcile (`thread.py:69-70`, REAL) advanced by live `phase_completed` count | reconcile + `phasesByThread` | empty: hidden pre-start; loading: "–/N" from reconcile; failed: append failure marker keyed off `run_failed`/`gate_failed` (NOT terminal sentinel — RC-4) | N is the real phase count of whatever definition ran. Honest ordinal, never a fake percent. |
| Phase row name | `phase.slug` | `phase_started.phase` (`engine:676`, wire-only) + definition `phases[].slug` | `phasesByThread[].slug` | empty: render from definition slugs (locked-ahead); loading: appears at `phase_started` | Friendly casing is presentational; slug is the generic identity. |
| Phase type tag | `phase.phase_type` (1 of 5) | `phase_started.phase_type` (`engine:680`, wire-only) + definition discriminator | `phasesByThread[].phaseType` | empty: read from definition for locked-ahead; UNKNOWN ⇒ generic "Step" | Label map over the 5 fixed literals — exhaustive, workflow-agnostic. |
| Status glyph + pill | `phase.status ∈ {pending, running, done, failed, retrying, skipped}` | running/done from `phase_started`→`phase_completed`; failed from terminal `gate_failed`/`run_failed`; retrying from non-terminal `gate_failed{attempt}`; skipped from `phase_transition.via`; pending derived from ordering | `phasesByThread[].status` via `onPhase*`/`onGateFailed`/`onRunFailed` | empty: all pending before run; loading: first flips to running; failed: red keyed off failure events; done: green | 5/6-state machine driven purely by generic lifecycle events. `gate_passed` is NOT on the wire (`engine:499` writes audit only, no `_emit`) — "passed" is INFERRED from advance. |
| Tool-whitelist chips on a phase | `phase.config.available_tools[]` | definition `phases[].config.available_tools` (`harness.py:53/67`); also `sub_agent_start.tools` for the spawned agent | derived from resolved definition (or `sub_agent_start.tools`) | empty: programmatic/llm_single/llm_human_input have NO `available_tools` ⇒ render no chips (not an empty box) | Renders whatever tool names are in that phase's whitelist; only agent/batch types HAVE the field. |
| Sub-agent child row | `{sub_run_id, description, status, summary}` | `sub_agent_start` (`task_service:575`) → `sub_agent_done{status,summary}` (`:877`) on PRODUCER stream | `tasksByThread` (`TaskRunIndexItem`, keyed `sub_run_id`) | empty: no children for non-agent/non-batch; loading: row per `sub_agent_start`; failed: child shows `sub_agent_done.status='failed'` without expanding siblings | Label = `description` (real, but prefixed "Overall topic… / Sub-question…" at `phase_types.py:295/361` — clean label = presentational trimming). |
| Final answer bubble + "(K sources)" | final assistant `text` (= last phase `ctx.final_output`, D-10) + `sources.length` | `delta`(final_text) → `sources`/`citations`/`confidence` (`engine:280-302`, `_surface_final_answer`) — RENDERED today | `bucketsBySurface` chat Message; `onSources`/`onCitations` | empty: hidden while running; loading: streaming `delta`; failed: failure card instead (RC-4), never empty prose | Generic final-answer render; `sources.length` is the real F7 union count at completion. |
| Chat "ran in workspace ▸" pointer | presence of active/completed harness run + `run.status` for color; click → `onExpand` panel | `workflowLockByThread` (presence) — STATIC, not a live mirror | `workflowLockByThread`; summary stamped onto the assistant message at terminal (frozen snapshot) | empty: no run ⇒ no pointer; loading: "Running in workspace…"; failed: "Run failed · see workspace ▸"; done: "ran in workspace ▸" | PANEL-06: must NOT re-render on phase events. Generic for any harness (or Deep tool) run. |
| Live pulse dot (panel head) | run-is-live = `streamingThreads.has(threadId)` OR `workflowLock` non-terminal | `streamingThreads` (SSE lifecycle) / `workflowLockByThread`; hidden at terminal | `streamingThreads: Set` + `workflowLockByThread` | empty: hidden; running: amber pulse; failed/done: hidden | Generic "a run is live" indicator. Amber per locked color language. |

### 4.2 — 008 phase-timeline (specific)

| UI element | Generic field | Source | Empty / loading / failed | Any-workflow note |
|---|---|---|---|---|
| Doing-now narration line | current phase `slug` + `phase_type` + (batch) running-vs-total sub-agent counts — client-composed sentence | `phase_started` (active phase) + `sub_agent_start`/`done` counts | empty: "Setting up…" briefly; failed: `run_failed.reason` copy; done: "Workflow complete" from `run_completed` | Template from generic `phase_type` + status counts; specific prose is fixture. |
| Programmatic result annotation | `len(return.sub_questions)` (split_topic) | NOT on the wire — `phase_completed` carries `{phase, phase_index}` only | done only, if surfaced | The `input_keys` reference is real; the count is wire-absent (§8-#3, §9-A1). |
| Gate retry sub-row | `gate_failed{phase, attempt, error}` per attempt; `max_retries` from `ValidatorSpec` | `gate_failed` SSE (`engine:486/:522`, EVERY attempt, wire-only) | empty: no gate rows (4 shipped seeds have ZERO active gates post-065); loading: per attempt; passed: INFERRED from advance | Gate vocabulary is real; the gate NAME is fixture (`gate_failed` carries no human gate name). `attempt`/`max` real. |
| Failure reason card | `run_failed.reason` (`engine:708`) OR `gate_failed.error` (validator msg OR `"wall_clock_timeout after Ns"`, `engine:480`) | both wire-only; key off these NOT the terminal sentinel (RC-4) | failed: render reason; CRITICAL empty: explicit "Failure reason not captured" sentinel, never an empty card | Reads `reason`/`error` verbatim; specific text is fixture. |
| Phase outcome bar fill | `phase.status` → color (done=green, running=amber shimmer, failed=red, locked=dashed); NOT a percentage | status events only; no progress-% field exists | running: indeterminate shimmer (correct, no fake %) | Status→color is honest; identical for any workflow. |
| Event-log rows (Variant C) | raw generic SSE names + payloads (`phase_started`/`phase_completed`/`phase_transition`/`sub_agent_start`/`sub_agent_done`/`gate_failed`/`run_failed`/`run_completed`) | all on `run:{run_id}` producer stream; phase_*/gate_failed/run_* wire-only | empty: no events pre-run; appends per event | Event-NAME vocabulary is the real contract; timestamps + detail strings are fixture. |
| Locked-ahead card (Variant D) | `phase.status='pending'` = `phase_index > active && no phase_started` | INFERRED from absence + definition phase list (no "locked"/"queued" event) | empty: all pending before run; flips to running on `phase_started` | Purely positional ordering; workflow-agnostic. "queued" label inferred, legitimately derived. |
| Collapsed phase-card summary | MIXED: status words real; agent-count real (tally); durations have NO wire source | status from lifecycle; agent count from `sub_agent_start` tally; durations would be client receipt-time deltas | empty: "locked"; loading: "running…"; done: count + (client-derived) elapsed | Durations partially INVENTED — derivable client-side, but no server duration field. |

### 4.3 — 009 unified-surface (specific)

| UI element | Generic field | Source | Empty / loading / failed | Any-workflow note |
|---|---|---|---|---|
| Panel count-strip chips | client-derived aggregates: phases.length, i/N, sub-agent count, sources.length, elapsed | `phase_*` + `sub_agent_start` (producer) + `sources` (end-of-run); tool/search counts on SUB stream only | empty: hide / "Phase 1/N"; loading: accrue live; failed: freeze | Every chip is a COUNT over generic events. Tool/search counts UNAVAILABLE on producer (§8). |
| Deep panel tool rows | `{tool name, status, result}` from Deep agent loop | `tool_start`/`tool_end` (api.ts:492/504) → `onToolStart`/`onToolEnd`; `execute_code` special-cased | empty: plain answer; running: active glow; done: result summary | execute_code is a TOOL (not a phase) — correctly a tool row. D-094-UNIFY relocates the Deep RunCard render INTO the panel (same data source). |
| Deep agent-loop iteration label | current / total iteration | `iteration_start{iteration}` (api.ts:650) / `planning{iteration}` | empty: iteration 1; done: frozen total | Generic to the agent loop. |
| Receipt phase-dots | per-phase `status`, one dot per phase | `phase_completed`/`phase_started`/`run_failed` | empty: no dots; mixed colors by status | Dot count = phases.length; Deep run has `dots:null` (tool-based, correct). MUST reflect real status incl. failure (not all-green). |
| Live-status pointer (Variant C) | is-streaming + current phase `slug` + i/N (harness) / current tool (deep) | `streamingThreads` + latest `phase_started`; STATIC pointer (PANEL-06) | empty: hidden; live: pulse; done: replaced by receipt | Snapshot refetched on reconnect, not a token-by-token mirror. |

### 4.4 — 010 honesty-and-drafts (specific)

| UI element | Generic field | Source | Empty / loading / failed | Any-workflow note |
|---|---|---|---|---|
| DRAFT block ("DRAFT · not yet saved" + body) | `ask_user_prompt.draft` (PendingAsk.draft) | `ask_user_prompt.draft` SSE (`phase_types.py:482-489`) + `GET /threads/{id}/ask_user/pending` (`panel.py`); api.ts:610 reads `parsed.draft` | empty: draft undefined (older streams / no upstream text) ⇒ hide draft, show question only; arrives whole with the prompt | Generic `_latest_phase_text` upstream of ANY `llm_human_input`. Render labelled, above the chips. |
| Ask question + chips + free-text | `ask_user_prompt.prompt` + `options[]` | `ask_user_prompt{prompt,options,timeout_seconds,tool_call_id}`; answer → `POST /runs/{id}/ask_user_response{tool_call_id,response_text,choice_index}` (`runs.py`) | empty `options[]` ⇒ free-text only (no chips); answered: `removePendingAskForThread` on `ask_user_response` | `options[]` is the generic authored menu. Answer surface is the PANEL card, NEVER the composer. |
| Long-draft preview ("≈ N words · long draft" + open-wide) | `ask_user_prompt.draft` + client-derived word/char count | same `draft`; word count = client length; edits → `ask_user_response.response_text` | empty: no draft ⇒ no preview; short ⇒ inline; long ⇒ open-wide | "preview vs open-wide" driven by draft length (generic). Literal word count = fixture; MUST be computed. |
| Batch sub-results list | `[sub_agent_done.summary for each child]` aggregated client-side | `sub_agent_start{description}` + `sub_agent_done{status,summary}` (producer) | empty: no list; loading: rows per start, summary on done; failed: per-child failed without expanding others | Count implicit (no aggregate field). Per-item source counts = INVENTED (§8). |
| Failure card title + badge + reason + where | `run_failed.reason` OR `gate_failed.error` + failing `phase.slug` | both wire-only; key off failure events NOT terminal sentinel (RC-4) | empty error ⇒ "Failure reason not captured" sentinel (NEVER empty card); failed: auto-expand failing phase, surface gate/tool name inline (GitHub-annotation model) | Generic binding; specific text is fixture. The empty-reason sentinel is the universal rule. |
| Failure taxonomy chips | derived classification (max_steps / gate_failed / wall_clock_timeout / reason_unknown) | inferred from `gate_failed.error` string + which event fired; only `"wall_clock_timeout after Ns"` is verbatim; NO discrete `failure_kind` field | unknown ⇒ "reason_unknown" chip | UI-derived buckets; backend emits no typed kind (§8). |
| sr-only announcer (role=status) + alerter (role=alert) | phase transition edges + failure | `phase_*` (polite milestones) + `run_failed`/`gate_failed` (assertive); `ask_user_prompt` → "Paused…" | empty: silent; loading: one sentence per edge (throttled); failed: assertive | Templated from generic index/slug/type; a11y §6.1 mandates generic narration. |

### 4.5 — 011 mode-and-composer (specific)

| UI element | Generic field | Source | Empty / loading / failed | Any-workflow note |
|---|---|---|---|---|
| Model pill (grouped provider+model) | selected `model` id (+ `provider`) per message | `GET /models` (MODEL_INFO) → value on `POST /threads/{id}/messages.model/.provider`; NOT an SSE event | empty: collapse to model-only if 1 provider; loading: disable until `/models`; failed: last-known/default | Per-message choice, workflow-agnostic. Harness phases inherit via `ctx.model` unless a phase config overrides. |
| General/Explorer pill | `agent_mode ∈ {"default","explorer"}` (Axis 1) | `POST /threads/{id}/messages.agentMode` (`useMessages.ts:108`); NOT SSE, NOT reconciled | empty/default: "General"; inert in harness branch | Per-message Deep knob; Axis 1 ⟂ Axis 2. Inert during a harness run — must not imply it controls a workflow. |
| Send → Stop | `canSend = !disabled && !workflowLocked && value.trim()`; Stop = `isStreaming` | derived (local value) + `streamingThreads` + `workflowLockByThread`; Stop → cancel run | empty value ⇒ disabled; running ⇒ Stop; terminal ⇒ Send | Per-thread streaming flag (never a global `isStreaming` — BUG-260523-01). D-092-UX removes the picker (no orphan silent-Deep send). |
| Disabled textarea + placeholder | `composer-disabled = streamingThreads.has(threadId) OR workflowLock !== null`; placeholder keyed off lock/pause sub-state | `workflowLockByThread` (mode/locked/cap_paused) + `streamingThreads` + `pendingAsksByThread` | idle: live; running/locked/paused: disabled with matching placeholder; terminal: re-enabled (stale-lock self-heal via `lock_is_stale`) | Lock gates textarea/Send only; D-092-UX drops the extra greyed pills. Placeholder copy static per sub-state. |
| Run-status chip / bar (Variant A/B) | `mode` + `definition_name` + `phase i/N` + current `slug`/`phase_type` + Cancel | name from definition; phase from `phase_*` (wire-only); Cancel → cancel path | empty: no chip without lock; loading: indeterminate phase until first `phase_started`; failed: keyed off `run_failed`/`gate_failed` (RC-4) | Progress % = INVENTED (no percent field; §8). Variant B duplicates panel — prefer A. |
| Panel mode tag (harness/deep) | server-truth `mode` | `GET /threads/{id}/workflow.mode` (`threads.py:1659`) + live lock/terminal; NOT a client useState | empty/Deep: "deep"; harness: "harness"; stale-lock self-heals to deep | Load-bearing: kills finding #5 — no client `workflowMode` to drift. |
| cap_paused Continue card (MessageItem) | `capPaused` + `continuesRemaining` (`max_continues_per_run − continues_used`, D-06) | `cap_paused{tool_names,continues_used,continues_remaining}` SSE → `onCapPaused` + reconcile; Continue → `POST /runs/{id}/continue` (`runs.py`) then `requestProducerResubscribe` | empty: hidden; present: "Continue (N left)"; exhausted: stop copy (3-cap) | Generic for any run (Deep or Harness) hitting its step budget. Stays in MessageItem, never composer or timeline. NON-terminal. |
| In-chat axis legend cards 1 & 2 | static IA legend (Axis 1 `agent_mode`; Axis 2 `active_workflow_run_id` presence) | static UI; active-chip highlight reads local `agentMode` / `workflowLockByThread` | n/a (static) | Teaches the 2×2; Harness is launched from Workflows page (012), never a composer toggle. |
| Nav rail Workflows entry | static `{view:"workflows", icon:Workflow, label:"Workflows"}` | static `NAV_ITEMS`; the page reads `GET /workflows/published` | n/a (always present) | Content-agnostic; launch-relocation that kills the composer dropdown. |

### 4.6 — 012 workflows-page (specific)

| UI element | Generic field | Source | Empty / loading / failed | Any-workflow note |
|---|---|---|---|---|
| Card title | `PublishedWorkflow.name` | `GET /workflows/published` (`workflows.py:38`, `ORDER BY name`) | empty: "No workflows yet" + build-new; loading: skeleton rows; failed: retry strip | Generic display name; never a fixed title. |
| Card Run-target id | `PublishedWorkflow.id` (UUID) | `GET /workflows/published.id` | no id ⇒ cannot Run (gate Run on id) | Kickoff key — passed verbatim as `MessageCreate.workflow_definition_id`. |
| Card slug sub-label / key | `PublishedWorkflow.slug` | `GET /workflows/published.slug` | inherits list fetch | Generic stable machine name. |
| Card source/scope tag (seed/draft/published/shared) + filter pills (H1) | `definition.status` (draft\|published — REAL, migration 056) + ownership (`user_id===me ? "yours" : is_global ? "shared" : —`) | needs §9-C endpoint to ADD `status` + `user_id`/`is_global` to the payload — `/published` returns NEITHER today | derived | empty: omit tag; loading: skeleton; failed: omit | `status` + owner-scope GENERALIZE to any workflow; the `seed` literal and the 4-value filter taxonomy are INVENTED fixtures (§8-#17). Render only the derivable halves. |
| Search box | client filter over `name` | derived from the loaded list (no search endpoint) | empty: "No workflows match"; loading: disabled | Pure client filter; purpose-match needs purpose in payload (absent). |
| List count "N workflows" | `filteredWorkflows().length` | length of the loaded list | empty: "0 workflows" | Pure client-derived count. |
| Phase chain mini-pills | `PhaseSpec.slug` + `phase_index` (order) | definition JSONB (`harness.py`); NOT in `/published` — needs §9 endpoint | empty: no chain; loading: skeleton; failed: hide chain, keep name+Run | Generic per definition; currently unfetchable client-side. |
| Phase pill type badge | `PhaseSpec.config.phase_type` (5-value discriminator) | definition JSONB; not exposed today | inherits chain availability | The same 5-value discriminator the timeline/builder key off. Color left-border maps from `phase_type`. |
| Tool-whitelist chips per phase | `PhaseSpec.config.available_tools` | definition JSONB; not exposed today | empty: programmatic/llm_single/llm_human_input have NO `available_tools` ⇒ no chips | Only agent/batch types HAVE the field — never assume tools for every phase. |
| Run button | POST staged `id` as `workflow_definition_id` | `POST /threads/{id}/messages{content, workflow_definition_id}` (`threads.py:766/819`) → `create_workflow_run` sets `active_workflow_run_id` + seeds `inputs.kickoff_prompt` | empty: disabled w/o id or kickoff text (silent-Deep-send risk §6); loading: spinner; failed: 409 (locked) / 404 (not owned) / 400 (not published) — surface, don't fall through | One endpoint kicks off all 5-type compositions; no per-workflow special-casing. |
| Launch modal kickoff textarea | `kickoff_prompt` (= `MessageCreate.content`) | client-collected; persisted by `create_workflow_run` as `inputs={kickoff_prompt: content}` (SEED-047); consumed by `phase_types._kickoff_prompt(ctx)` | empty: Run disabled (required); loading: disabled on submit; failed: keep value | The ONE universal launch input for ANY workflow (the first phase's user turn). Field LABEL is fixture flavor. |
| In-thread reconcile chips ("Phase i/N") | `current_phase_index` + `total_phases` + `current_phase_slug` | `GET /threads/{id}/workflow`; live via `phase_*` (dropped today) | empty: hidden; loading: reconcile pending; failed: last-known from reconcile | Honest ordered-progress fields; never a fake percent. |
| In-thread panel mini-timeline | per-phase `slug` + `status` + `phase_type` | `workflow_phases.status` (persisted, `load_run_phases`) + live `phase_*` (`engine:676/773`, dropped today) | empty: PanelEmpty; loading: queued/locked-ahead; failed: red keyed off `gate_failed`/`run_failed` (RC-4) | Generic per-phase fields; 5-state legend from `status` + `gate_failed.attempt`. |

### 4.7 — 013 workflow-builder (specific) — DESIGN NOW, BUILD v2.9

| UI element | Generic field | Source | Status | Any-workflow note |
|---|---|---|---|---|
| Phase card name | `PhaseSpec.slug` | definition JSONB | REAL field; authoring-stream proposal = INVENTED (no authoring SSE) | NL-friendly names are sample; render slug, N cards for N phases. |
| Phase type badge (all 5 classes) | `PhaseConfig.phase_type` (5 LOCKED literals) | `harness.py:90-99` discriminated union | REAL | THE core generalization point — "don't invent node types." 5 and only 5. |
| Tool-whitelist chips | `available_tools[]` (agent/batch only) | `harness.py`; valid names = dispatcher registry (`tool_dispatcher.py TOOL_HANDLERS`) | REAL | Tool chips only on agent/batch phases — generic rule honored. |
| Node glyph / spine order | `PhaseSpec.phase_index` (contiguous 0..N-1; lint BAD_INDEX) | `harness.py` | REAL ordering | Skip edges from `ValidatorSpec.on_failure='skip_to_phase:<slug>'`. |
| Gate marker / "Gate: none" | `PhaseSpec.validators: list[ValidatorSpec]` (`kind ∈ json_schema\|regex_match\|workspace_file_exists\|programmatic`; `on_failure ∈ fail_run\|retry\|skip_to_phase:<slug>`; `max_retries=2`) | `harness.py:102-108` | REAL vocabulary; all 4 seeds have ZERO active gates post-065 ⇒ "none" truthful default | Builder MUST be able to render an ACTIVE gate for authored workflows (sketch shows only "none" — a gap). |
| Inferred-inputs strip | union of `input_keys` across phases minus upstream-satisfied (= INPUT_UNSATISFIED lint) | `ProgrammaticPhaseConfig.input_keys` + `kickoff_prompt` universal | `input_keys` REAL; AI-INFERENCE INVENTED; `+add input` write INVENTED | Generic field = "run inputs the entry phase needs." |
| Per-phase KB scope chip | a NEW `folder_ids: list[str]` on the phase config | runtime filter REAL (`ctx.folder_subtree_ids` → `search_documents(folder_ids=…)`); but field does NOT exist on any `PhaseConfig` — run/thread-scoped today | INVENTED field (README "Build path: add folder_ids…") | Generalizes IFF bound to per-phase `folder_ids[]`; chip appears only for phases including `search_documents`. |
| Lint badge (5 checks) | reachability lint over `phases` (ORPHAN / NO_TERMINAL / BAD_INDEX / UNSATISFIABLE_SKIP / INPUT_UNSATISFIED) | `backend/app/services/harness/reachability.py` + `model_validate` strict-parse | checks REAL (run at engine/seed load); LIVE lint-on-draft endpoint INVENTED | Structural over `phases`/`phase_index`/`ValidatorSpec`. Must render a RED failure naming WHICH check (sketch only shows green/pending). |
| Publish & lock / version | `status` (draft→published), `version` (int), `UNIQUE(slug,version)`, immutable-on-publish trigger | migration `056_workflow_definitions.sql` (REAL schema) | schema REAL; author-write/publish API INVENTED | v1→fork-v2-draft lifecycle binds to the row lifecycle, not seed content. |
| Talk rail / composer / approve-tweak-replace / assets / "proposing next phase…" | — | NO authoring SSE, thread, LLM pipeline, asset schema, or approval field | ALL INVENTED (v2.9 / SEED-051) | Conceptually generic; zero runtime binding today. |

---

## 5. SHARED REGISTRIES & FORMULAS

All registries are client-side constants keyed on GENERIC runtime fields. **No workflow content ever appears in a registry.**

### 5.1 `PHASE_TYPE_LABEL` — `phase_type` → label + glyph + one-liner

| `phase_type` | Human label | Glyph | Plain one-liner |
|---|---|---|---|
| `programmatic` | "Server step" | gear/function | "A fixed server function ran — no AI." |
| `llm_single` | "AI write step" | pen | "One AI message — think/write." |
| `llm_agent` | "AI agent step" | robot | "An AI agent using allowed tools, looping until done." |
| `llm_batch_agents` | "Parallel agents" | robots/fan-out | "Many AI agents at once, results merged." |
| `llm_human_input` | "Needs you" | person | "Paused — waiting for your input." |

Keyed on `phase_started.phase_type`. A new authored workflow auto-labels because its phases MUST be one of these 5 (extra-forbid in `harness.py`). Fallback: `PHASE_TYPE_LABEL[unknown] ?? "Step"`.

### 5.2 `TOOL_LABEL` — tool name → human label

Keyed on `config.available_tools` / `sub_agent_start.tools` / `tool_start.name`. Examples: `search_documents` → "Search knowledge base", `web_search` → "Search the web", `execute_code` → "Run code", `ask_user` → "Ask you", `read_document` → "Read a document". **Fallback `prettify(name)` (snake → Title Case)** so an authored workflow naming an unmapped tool still renders cleanly.

### 5.3 `STATUS_GLYPH` — status → glyph + text + color (non-color-alone, a11y §6.6)

| status | glyph | text | color token |
|---|---|---|---|
| `pending` (locked-ahead) | ○ hollow / dash | "Locked" | dimmed `--panel-muted-foreground` |
| `running` | pulse/spinner + progressbar | "Running" | amber `--warning` / `--panel-status-active` |
| `done` | ✓ filled | "Complete" | green `--success` / `--panel-status-done` |
| `failed` | △! / ✕ | "Failed" | red `--destructive` |
| `retrying` | ↻ | "Attempt N" | purple (distinct) |
| `skipped` | ⤳ | "Skipped" | dimmed grey |
| `paused` (ask_user) | person/pause | "Needs you" | amber `--warning` |

Color language LOCKED (BRIEF §2.6): amber = pending/Harness/needs-you, green = done, red = error/diff-base, indigo = normal/count. Always pair color with glyph + text (never color alone).

### 5.4 `COUNT_FORMULAS` — how "N x / K y" derive CLIENT-SIDE (never a server field)

None of these counts is a wire field; all are client tallies — which is why hardcoding "48 sources" is INVENTED.

- **`phaseProgress` = `current_phase_index + 1` / `total_phases`** → "Phase 3 / 5". Source: reconcile `ThreadWorkflowState` (real), advanced by live `phase_completed` count.
- **`agentsSpawned`** (batch) = `count(sub_agent_start for the active/parent phase)`. No aggregate field exists.
- **`toolCalls`** = `count(tool_start)` — BUT these fire on the SUB stream, not the producer. ONLY available if §9-B threads them up. On the producer stream alone → UNAVAILABLE → INVENTED if shown.
- **`sources`/`citations`** = `(sources event).sources.length` / `(citations event).citations.length` — available ONLY at end-of-run (the F7 union), via existing `onSources`/`onCitations`. Per-phase or mid-run source counts are NOT available → INVENTED.
- **`subResults`** (batch) = `[sub_agent_done.summary for each child of the phase]` — client aggregation.
- **`elapsed`** = client wall-clock from the RunCard timer (existing `elapsedSeconds`, recomputed every 250ms, freezes at terminal). Never a server "73%".

**Generalization rule for counts:** a count chip renders ONLY if its formula resolves to a real tally of received events or a reconcile field. If the only source is the sub stream (tool calls) or there is no source at all, the chip is SUPPRESSED, not faked.

---

## 6. EMPTY / LOADING / FAILED / UNKNOWN CONTRACT

Every timeline element must handle these without rendering an empty or misleading card.

- **EMPTY (no run yet):** `phasesByThread.get(threadId)` undefined/empty AND reconcile `mode==="deep"` → render nothing harness-specific; fall back to existing `PanelEmpty` ("No workspace activity yet"). The timeline section mounts only when `mode==="harness"` OR phases exist.
- **LOADING (mount, reconcile in flight):** reconcile gives `total_phases` + `current_phase_index` before any live event. Render the full skeleton of N phase rows in `pending`, with the current one `running` — derived from reconcile, NOT a spinner. This is the spinner-killer at mount: "Phase 3 / 5, Research, running" appears from reconcile alone.
- **FAILED — RC-4 (the cardinal contract):** failure is keyed off **`run_failed.reason`** / terminal **`gate_failed.error`**, NEVER the terminal sentinel (which is wrongly `done` on failure — `threads.py` RC-4 bug). The failing phase row goes red, auto-expands, surfaces the reason inline (GitHub-annotation model). Distinct reasons to taxonomize: a validator message (gate), `"wall_clock_timeout after Ns"` (`harness_engine.py:480` — a real distinct string), `run_failed.reason` (run-level, `engine:708`), and the `skip_to_phase` runtime-guard reason (`engine:726`).
- **`reason_unknown` fallback:** if `run_failed.reason` is empty/missing OR a `gate_failed.error` is empty, render the explicit sentinel **"Failure reason not captured"** — NEVER an empty red card.
- **GATE_PASSED IS AUDIT-ONLY (inference rule):** there is NO `gate_passed` event on the wire (`harness_engine.py:499` writes audit only, `event_type="gate_passed"`, no `_emit`). A passed gate MUST be inferred from the phase advancing — a subsequent `phase_transition` or the next `phase_started`/`phase_completed`. The renderer NEVER waits for or renders a `gate_passed` event; absence of `gate_failed` + advance = passed.
- **UNKNOWN phase_type:** not one of the 5 → generic row (`PHASE_TYPE_LABEL[unknown] ?? "Step"`, neutral glyph, status only). Never crash on an unrecognized discriminator.
- **CAP_PAUSED:** `cap_paused` (reconcile + `cap_paused` SSE → `onCapPaused`) is NON-terminal — the stream stays attachable. The Continue card stays in `MessageItem` (amber, "Continue (N left)"), NOT the timeline and NOT the composer. The timeline shows the current phase as paused-but-resumable, distinct from `failed`.
- **ASK_USER-PAUSED:** `ask_user_prompt` with no matching `ask_user_response` yet → the `llm_human_input` phase is `paused`; the panel `PendingAskCard` is the answer surface (never the composer). On timeout (no response within `timeout_seconds`), the executor returns `answer=""` and the phase completes — render as completed-with-empty-answer, NOT failed.
- **DRAFT-MISSING:** `ask_user_prompt.draft` is additive (D-12) — older streams / phases with no upstream text have no draft (`draft` undefined). Hide the draft block, show the question + chips only. Never render an empty "DRAFT" box.
- **STALE LOCK:** reconcile `lock_is_stale === true` → treat the thread as unlocked/Deep, self-heal; do not render a live timeline for a terminal/missing run.
- **NO-FILES / generated artifacts:** generated files from `execute_code` fire on the SUB stream and are not threaded to the harness producer (§9-B). The panel FILES tab reads from the workspace store (087), not the harness stream — absence of files is normal, render the empty FILES state, never a phantom file card.

---

## 7. TEST FIXTURES

Each fixture is an array of `{data: JSON.stringify({type, ...fields})}` lines matching the EXACT producer wire (the `_emit` shape, `harness_engine.py:105`) so components are built+tested against real payloads, not mocks. Each must be a flat string array replayable through `subscribeToRun`'s line parser (api.ts:471-680) so the test exercises the REAL normalizer, not a stubbed callback. Naming: `fx-phase-<type>` and `fx-run-<state>`.

### Per-phase-type fixtures (minimal real producer sequence per type)

- **`fx-phase-programmatic`**: `phase_started{phase:"split", phase_index:0, phase_type:"programmatic"}` → `phase_completed{phase:"split", phase_index:0}` → `phase_transition{from_phase:"split", to_phase:"review"}`. *(Asserts "completed" with NO INVENTED count — return dict is not on the wire.)*
- **`fx-phase-llm_single`**: `phase_started{phase_type:"llm_single"}` → `phase_completed`. *(Asserts no per-phase body text rendered.)*
- **`fx-phase-llm_agent`**: `phase_started{phase_type:"llm_agent"}` → `sub_agent_start{sub_run_id, description, tools:["search_documents"], max_steps:12}` → `sub_agent_done{sub_run_id, status:"completed", summary}` → `phase_completed`. *(Asserts ONE child row; tool-call count NOT shown from producer.)*
- **`fx-phase-llm_batch_agents`**: `phase_started{phase_type:"llm_batch_agents"}` → 4× `sub_agent_start{sub_run_id_n, description, tools:["search_documents"], max_steps:12}` → 4× `sub_agent_done{sub_run_id_n, status, summary}` → `phase_completed`. *(Asserts `agentsSpawned===4` DERIVED from the start tally, not a field; 4 nested rows sharing a time band.)*
- **`fx-phase-llm_human_input`**: `phase_started{phase_type:"llm_human_input"}` → `ask_user_prompt{tool_call_id, prompt, options:["Looks good","Needs changes"], timeout_seconds:300, draft:"<prior phase text>"}` → (pause) → `ask_user_response{tool_call_id}` → `phase_completed`. *(Asserts draft renders ABOVE chips, labelled draft; pending-ask uses the existing store.)*

### Per-run-state fixtures (full-run sequences)

- **`fx-run-running`**: reconcile seed `{mode:"harness", definition_name, current_phase_index:1, total_phases:3, run_status:"running", latest_producer_run_id}` + live `phase_started`/`phase_completed`/`phase_transition` advancing, last phase still `running`. *(Asserts "Phase 2 / 3" from reconcile, advanced by live; pending phases skeletoned.)*
- **`fx-run-gatefail-retry`**: `phase_started` → `gate_failed{phase, attempt:1, error:"<validator message>"}` → (non-terminal retry) → `gate_failed{phase, attempt:2, error}` → `phase_completed`. *(Asserts per-attempt stacked rows "Attempt 1 / Attempt 2", purple `retrying`, then green; NO `gate_passed` — pass inferred from `phase_completed`.)* **`wall_clock` variant:** `gate_failed{attempt:1, error:"wall_clock_timeout after 600s"}`.
- **`fx-run-failed`**: `phase_started` → `gate_failed{phase, attempt:2, error}` (exhausted) → `run_failed{reason}` → terminal `done` (the RC-4 wrong sentinel). *(Asserts failure keyed off `run_failed`, NOT `done`; renders FAILED despite the `done` sentinel.)* **Companion `fx-run-failed-reason-unknown`**: same but `run_failed{reason:""}` → asserts the "Failure reason not captured" sentinel.
- **`fx-run-askuser-paused`**: `phase_started{phase_type:"llm_human_input"}` → `ask_user_prompt{tool_call_id, prompt, options, timeout_seconds:300, draft}` → stream idles (no terminal). *(Asserts paused state, draft visible, PendingAskCard is the answer surface, composer stays locked.)*
- **`fx-run-done`**: full happy path: `phase_started`/`completed`/`transition` ×N → `delta`(final_text) → `sources{sources:[...]}` → `citations{citations:[...]}` → `confidence{level, avg_similarity, disclaimer}` → `run_completed{status:"completed"}` → terminal `done`. *(Asserts run-level "K sources" from `sources.length` at completion; collapsed RunCard row "N phases · K sources" where K = union count and "N phases" = `total_phases` — both real; "M tool calls" SUPPRESSED unless §9-B added.)*

**vitest-axe** runs against the rendered output of `fx-run-running` / `fx-run-failed` / `fx-run-done` / `fx-run-askuser-paused` per a11y §6.8.

---

## 8. INVENTED-DATA FLAGS

Storyboard values with NO real runtime source. Treat as PLACEHOLDER-ONLY — derive legitimately or suppress before build.

1. **"6 searches" / "16 tool calls" / "3 searches" / "9 tool calls"** — tool events fire on the SUB stream (`run:{sub_run_id}`), NOT the harness producer stream. UNAVAILABLE on the timeline today. → suppress, or close §9-B.
2. **"48 sources" / "26 sources" as a PER-PHASE or MID-RUN chip** — source counts exist ONLY in the end-of-run `sources`/`citations` union (`engine:280-302`, arrives ONCE at run end). A per-phase or running-total "K sources" is INVENTED; only a run-level completion "K sources" (= `sources.length`) is real.
3. **"4 subtopics" / "4 agents"** — REAL but DERIVED. Programmatic return `sub_questions.length` is persisted-only, NOT on the producer wire (§9-A1). Agent count = tally of `sub_agent_start`. Render from the tally; never hardcode 4.
4. **Per-phase prose/body for `llm_single` / `programmatic`** — return dicts are persisted-only; only the FINAL phase's `text` reaches chat (`ctx.final_output`). Per-phase body content in the timeline is INVENTED.
5. **Any `gate_passed` glyph driven by an event** — no such event (`engine:499` audit-only). Pass is INFERRED from advance. A green "gate passed" badge tied to a wire event is INVENTED.
6. **Per-card phase-chain detail on the Workflows page (012)** — `GET /workflows/published` returns only `{id, slug, name}`. Phase types / tool chips / input_keys per card have NO client data source → require §9-C endpoint.
7. **KB / chunk-count line ("DBA · …Chapters 1-4 (843 chunks)")** — no folder-scope or chunk-count field reaches the panel; `RunContext.scoped_folder_path` is server-only. INVENTED.
8. **Per-sub-agent stats "2s · 5t · 14src" and per-item batch source counts ("14 src")** — `sub_agent_done` carries only `{sub_run_id, status, summary}`; per-agent tool/search/source counts live on the sub stream. INVENTED.
9. **Per-phase durations / call counts ("12.3s", "0.1s", "4.8s", "1 call", "18s")** — no duration or call-count field on `phase_started`/`phase_completed`. Client CAN approximate elapsed from receipt timestamps (a real derivation), but the literal values are fixture and "1 call" has no source.
10. **Gate NAME ("contains 'INTEGRATED'")** — no shipped seed (post-065) has any active gate; `gate_failed` carries `{phase, attempt, error}`, not a human gate name. INVENTED label; `attempt`/`max` are real.
11. **Sub-agent "queued ○" state** — no event signals an unspawned (Semaphore-blocked) agent; `sub_agent_start` only fires once admitted. INVENTED.
12. **Variant B progress bar fill ("width:62%")** — no percent/progress field on any event; the only honest derivation is the phase-index ratio (i/N). A literal % is INVENTED and forbidden (anti-pattern §5.1).
13. **Receipt phase-dots all-green** — real per-phase status includes running/locked/failed/retrying; an all-green hardcode has no basis for an in-progress or failed run. Must read `phases[].status`.
14. **Failure taxonomy as a fixed 4-value enum** — backend emits NO discrete `failure_kind`; only `"wall_clock_timeout after Ns"` is verbatim. The chips are a UI-derived classification over `gate_failed.error` + which event fired.
15. **Long-draft literal word count ("≈ 1,950 words")** — must be computed from `ask_user_prompt.draft` length at render time.
16. **Model name "openai/gpt-5.4"** — representative/fixture id; real value = whatever `GET /models` serves.
17. **Workflow icons (emoji), purpose/description text, the `seed` scope literal + the 4-value filter taxonomy, input-needs friendly labels, "Knowledge base scope" selector flavor, non-seed sample workflows** (012) — no icon/description/scope-enum/asset fields exist on `workflow_definitions` or `/published`. All sketch fixtures. **NOTE (H1):** a card's draft/published `status` AND its owner-scope ("yours" vs "shared/global") ARE real (migration 056 `status` + `user_id`/`is_global`) — see §4.6 "Card source/scope tag"; only the `seed` literal + the 4-way taxonomy are invented. Generic fixes require the §9-C payload to expose `status` + ownership.
18. **Entire 013 authoring surface** (talk rail, authoring SSE / "proposing next phase…", approve/tweak/replace, assets, per-phase `folder_ids`, live lint-on-draft endpoint, publish/version write path) — v2.9 / SEED-051 vision; zero runtime binding today.

**The deeper note (010/008 honesty):** the timeline phase rows, status glyphs, "doing now" line, fail card, and run-status dot are "wire-emitted but currently dropped" — the events exist on `run:{run_id}` but api.ts has no branch and there is no `phasesByThread` store. As of today's code they render with NO real store source until §9-A is built. And failed-run coloring is not achievable today because `run_failed`/`gate_failed` are dropped AND RC-4 follows a backend `run_failed` with a `done` sentinel — so a failed harness run currently surfaces as a wrong green "done" with empty content. The honest-failure card has no real source until RC-4 is fixed AND the failure events get api.ts branches.

---

## 9. BUILD PREREQUISITES

Backend/wiring gaps that MUST close for this contract to hold. Ordered by how much of the contract each unblocks.

**A. Wire the dropped phase events (the spinner-killer — the heart of 094).**
- A1. Add api.ts branches for `phase_started`, `phase_completed`, `phase_transition`, `gate_failed`, `run_completed`, `run_failed` (the switch at api.ts:485-667 has none — verified between `sub_agent_start` at 511 and `ask_user_prompt` at 600). Each calls a new `onPhase*`/`onGateFailed`/`onRunFailed` callback.
- A2. Add the `phasesByThread: Map<threadId, Phase[]>` store slice beside `workflowLockByThread`, with `*PhasesForThread` actions and a `usePhases(threadId)` hook (mirror `useTodos`). Panel-only (PANEL-06).
- A3. (Optional, for §8-#3) emit the programmatic return dict (`sub_questions`) on `phase_completed` or a new event so the "N sub-topics" count has a wire source. Until then, programmatic rows show "completed" only.

**B. Sub-agent tool/file threading (closes §8 #1, #8, #14 partial; 093 finding #4).**
- The sub-agent's `tool_start`/`tool_end`/generated-files fire on `run:{sub_run_id}`, never the producer. To render per-phase "N tool calls / K sources" and generated artifacts in the harness timeline, either thread those sub-stream events UP to the producer, OR have the panel drill into `run:{sub_run_id}` on demand. Without this, all per-phase tool/search/source counts stay SUPPRESSED.

**C. Expose the parsed definition to the client (closes §8-#6, unblocks 012/013 chains).**
- `GET /workflows/published` returns only `{id, slug, name}` (`workflows.py:38`). Add a thin `GET /workflows/{id}` returning `definition.phases` (or widen `/published`) so per-card/per-phase chips (phase types, tool whitelists, `input_keys`, gate markers) have a client source.

**D. RC-4 terminal-sentinel fix (mandatory for honest failure).**
- The terminal sentinel is wrongly `done` on failure (`threads.py` RC-4). Until fixed, the UI MUST key failure off `run_failed.reason`/`gate_failed.error` and ignore the `done` sentinel for failed runs. Fixing RC-4 at the source is the durable resolution.

**E. v2.9 / SEED-051 (013 builder) — out of scope for 094, design-only.**
- Per-phase `folder_ids: list[str]` on `PhaseConfig`; live lint-on-draft endpoint; author-write/publish API (schema in migration 056 exists, no write path); workflow assets (Storage-backed); NL→`WorkflowDefinition` authoring pipeline + authoring SSE; workflow `description`/icon/scope fields on `workflow_definitions` + `/published`.

---

## 10. POST-REVIEW ADDENDA (adversarial completeness pass — M/L clarifications)

One-line clarifications that prevent build-time guessing (the HIGH items H1/H2 are folded into §2/§4.6/§8 above).

- **M1 · 009 receipt (Deep vs harness).** Receipt left-border color = `mode` (amber=harness / indigo=deep — already a server fact, §4.1). A Deep run has `dots:null`; its substitute metric = `count(tool_end)` (a real Deep-loop tally) so the receipt is never empty for either mode.
- **M2 · doing-now narration (008/§4.2).** State set is the full 6: add **`retrying`** (template from `gate_failed{attempt}` + slug + `phase_type`) and the pre-first-event **"Setting up…"** (derived from reconcile `run_status==="running"` before the first `phase_started`) — not just empty/failed/done.
- **M3 · 010 long-draft approve-with-edits payload.** Edited overlay body → `ask_user_response.response_text`; chip → `choice_index`; **both can be present** — precedence: `response_text` carries the edited draft, `choice_index` the disposition. Approve WITHOUT editing → send the `draft` verbatim as `response_text` (or empty + `choice_index`). **Confirm exact precedence against `runs.py` `submit_ask_user_response` before build** — do not guess.
- **M4 · 011 run-status chip loading.** On reconnect the chip's current-phase label reads **`current_phase_slug` from reconcile** (`thread.py`), NOT "indeterminate until first `phase_started`" — same reconcile-floor rule §6 LOADING applies to the timeline.
- **M5 · 013 folder-tree DATA is REAL.** The scope picker's folder tree = the existing **`GET /folders`** (real, RLS-scoped, nested — shared with `search_documents`). Only the per-phase **`folder_ids[]` binding** + the picker UI are net-new (v2.9, §9-E). "Real data source, new binding" — the picker can be prototyped against live folders, unlike the fully-invented authoring surface.
- **L1 · no harness iteration counter.** Deep's "iteration N" label (§4.3) has **no harness analog** — a phase's internal `iteration_start` is on the sub stream (§8-#1). Don't render a per-phase iteration count.
- **L2 · event-log timestamps (008 Variant C).** The real client substitute for the fixture `00:07` timestamps = receipt-time deltas (same derivation as `elapsed`, §5.4).
- **L3 · 010 failure "where" line.** Only `phase.slug` (+ `gate_failed.phase`) is REAL in the `where` string; the sketch's model name / sub-agent index / step-ratio are INVENTED (sub-stream, §8-#8/#16). Render only the real components.

**Completeness verdict:** after H1+H2 (applied) the contract generalizes to any published `WorkflowDefinition`; M1–M5 remove build-time ambiguity; L1–L3 are polish. §6 (states) and §7 (fixtures) passed the adversarial pass unchanged.

### Verified key files

`backend/app/models/harness.py:33-124` (5 configs + `ValidatorSpec` + `WorkflowDefinition`; discriminator at :90-99) · `backend/app/services/harness/phase_types.py` (5 executors: 201/234/255/320/407; returns at 252/311/398/503; ask_user emit 482-489; `_latest_phase_text` 514) · `backend/app/services/harness/programmatic.py` (split_topic → sub_questions) · `backend/app/services/harness_engine.py` (`_emit` 105; phase_started 676-677; gate_failed 486/522; gate_passed audit-only 499; run_failed 708; final-answer surfacing 280-302; wall_clock string 480; skip_to_phase 557/726) · `backend/app/services/task_service.py:575/877` (sub_agent_start/done on PARENT producer stream) · `backend/app/api/workflows.py:28-38` (published list = id/slug/name only) · `backend/app/api/threads.py:1659` (ThreadWorkflowState reconcile) · `backend/app/models/thread.py:48-85` (ThreadWorkflowState fields) · `frontend/src/lib/api.ts:485-667` (the SSE normalizer — phase/gate/run branches MISSING; sub_agent_start 511, sources/citations 566-569, ask_user_prompt 600-610) · `frontend/src/stores/streamsStore.ts` (per-thread Maps; `phasesByThread` to be added beside `workflowLockByThread`).
