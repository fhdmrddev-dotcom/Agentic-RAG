---
gsd_state_version: 1.0
milestone: v2.8
milestone_name: Harness Engine & Workflow Mode
status: executing
stopped_at: Phase 092 Plan 01 — BLOCKED at Task 3 (operator migration-063 apply checkpoint)
last_updated: "2026-05-31T11:14:00.000Z"
last_activity: 2026-05-31 -- Phase 092 Plan 01 Tasks 1-2 committed; paused at Task 3 human-verify checkpoint
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 19
  completed_plans: 15
  percent: 79
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-30 after v2.7 close)

**Core value:** The agent acts as an AI colleague -- it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** Phase 092 — dual-mode-wiring-continue-button

## Current Position

Phase: 092 (dual-mode-wiring-continue-button) — EXECUTING
Plan: 1 of 4
Plans: 4 plans / 4 waves (sequential, 1 plan per wave). Wiring phase — connects the Phase 090/091 harness substrate to the live app: MODE-01 (Deep/Harness mode switch + workflow-run creation), MODE-02 (server-side Harness→Deep authz lock), CONT-01 (Continue button). OWNS the workflow-start trigger (INSERT INTO workflow_runs) that unblocks 091's persisted cross-provider UAT + closes SEED-047 (persist inputs+model into resume ctx).

  - Wave 1: 092-01 (schema migration 063 + test foundation — autonomous:false, operator SQL-editor apply checkpoint)
  - Wave 2: 092-02 (MODE-01 mode switch + workflow-run creation + MODE-02 server-side lock-refusal — autonomous)
  - Wave 3: 092-03 (MODE-02 cancel/terminal lock-clear + CONT-01 Continue — autonomous)
  - Wave 4: 092-04 (frontend: Deep/Harness toggle + published-workflow picker + Continue button — autonomous:false, UAT checkpoint)

### Phase 091 (prior) — ✅ COMPLETE

8 plans / 6 waves — VERIFICATION PASSED (iteration 2). Gap-closure plan 091-08 (wave 6) closed all code-review Criticals + actionable Warnings; 091-REVIEW.md status → resolved.

Reqs covered: HARNESS-01, HARNESS-03, HARNESS-04, HARNESS-05, HARNESS-07, TOOL-05 (all 6). Highest-risk surfaces isolated with deterministic proof: 2-phase write (Plans 02/04), ask_user re-subscribe subscribe-before-emit (Plan 04). Migration 061 (4 seed templates) applied LIVE via the operator SQL-editor checkpoint (no db push) — all 4 rows present, published, global; full-schema.sql unchanged (data-only migration; tables already present from migration 060). 4-axis UAT (SC#10) in VALIDATION manual-only rows — owned by the verifier.

Prior phase: 090 (Harness Schema + RLS + Config Models) — ✅ COMPLETE. 3/3 plans + migration 060; substrate live (4 tables + threads.active_workflow_run_id), RLS + immutable-on-publish + INSERT-only audit confirmed against live DB.
Scope: HARNESS-01..07 (state-machine workflow runtime, 5 phase types, validation gates, resumable runs, audit, seed templates) + MODE-01/02 + CONT-01 (Continue) + PANEL-08/09 + A11Y-03 + EVAL-01/02 + CONC-01 + TOOL-05 + FOUND-03 (G-5 extraction) + CF-01 (carry-forward sweep) + 2 polish riders (CHAT-04 chat-card unification, PARITY-01 Anthropic parity). PLUGIN-01..03 + `super_admin`/operator role tier DEFERRED to v2.9. See PROJECT.md D-v2.8-01.
Phase 091 ✅ COMPLETE (2026-05-31): all 8 plans shipped (Waves 1-6); verification 6/6 automated must-haves, status human_needed → operator-approved. Gap-closure 091-08 closed both code-review Criticals (CR-01 resume double-exec via claimed_at lease CAS/migration 062 + CR-02 silent >64KB output loss) + WR-03/04/05/06 + IN-01; 091-REVIEW.md → resolved. Harness suite 95/95 green vs live DB. SC#10 4-axis cross-provider UAT persisted in 091-HUMAN-UAT.md — BLOCKED on the Phase 092 workflow-start trigger (no INSERT INTO workflow_runs exists yet). WR-01/WR-02 (resume ctx inputs/model rehydration) DEFERRED to Phase 092 via SEED-047 (re-open trigger: 092 run-creation persists workflow_runs.inputs+model; Phase 096 EVAL-02 is the proof gate).

Next: Phase 092 — dual-mode wiring + Continue button. No CONTEXT.md yet → start with `/gsd:discuss-phase 092` (recommended) or `/gsd:plan-phase 092`. Note for 092: it OWNS the workflow-start trigger (run creation) that unblocks 091's persisted cross-provider UAT, and must persist workflow_runs.inputs+model to close SEED-047.
Phase order + dependencies: 089 (extract, BLOCKING, ships first) ‖ 090 (schema, parallels 089) → 091 (engine + 5 types + gates + whitelist; whitelist folds in here) → 092 (dual-mode + Continue) → 094 (panel timeline). 093 (Anthropic parity) after 089. 095 (chat-card) after 089. 096 (eval + verify) last, after all features.
G-5: SATISFIED by Phase 089 (`threads.py` 3,186 LOC extraction).
G-2 FIRES: Phase 094 (panel phase timeline) AND Phase 095 (chat tool-card unification) — `/gsd:sketch` before spec/plan; operator-approved mockup is the acceptance bar.
SC#10 4-axis UAT (cross-provider × multi-tool × parallel-thread × long-message) baked into success criteria for 089, 091, 092, 093, 094, 095, 096.
Carry-forwards into v2.8 (verify at kickoff via CF-01 in Phase 089): BUG-260527-01 title-gen (DeepSeek/Moonshot/Google, fixed-but-unverified), Google secondary-model 404, download-link payload. 087 panel deferrals SEED-037/038/039 (037 download → standalone `/gsd:quick`).

v2.8 CLOSURE CHECKLIST (do NOT do per-phase):

- SECURITY PASS — run `/gsd:secure-phase` over the workflow-runtime phases 090 → 091 → 092 at milestone closure (anchor on 092, where the server-enforced Harness→Deep authz lock lands). Risk-based: these 3 phases hold the milestone's real security surface (RLS / tool-whitelist execution gate / server-side mode lock); 093/094/095 are low-surface UI/provider polish. Not urgent because 090 RLS is already live-verified and 091's code review already cleared eval/SQL-injection/secrets + the whitelist no-op invariant. PULL FORWARD to right after 092 ONLY if v2.8 ships to real/production users before closure. (Project has produced SECURITY.md only twice ever — secure-phase has never been per-phase here.)

Last activity: 2026-05-31 -- Phase 092 execution started

Progress: [█████████░] 93%

## Performance Metrics

**Velocity:**

- Total plans completed: 37 (v2.7)
- Prior milestones: v2.6 shipped 91 plans in 16 days (~5.7 plans/day)
- Average duration: ~12min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 083 | 3 | - | - |
| 084 | 5 | - | - |
| 085 | 5 | - | - |
| 087 | 5/5 | - | ~8min (087-02) |
| 088 | 5 | - | - |
| 089 | 4 | - | - |
| 091 | 8 | - | - |

**Recent Trend:**

- Last 5 plans: (from v2.6 close)
- Trend: Stable

| Phase 088 P088-01 | 13min | 3 tasks | 15 files |
| Phase 088 P088-02 | 6min | 2 tasks | 1 files |
| Phase 088 P088-03 | 3min | 2 tasks | 1 files |
| Phase 088 P088-04 | 75min | 3 tasks | 4 files |
| Phase 088 P088-05 | 1h 40m | 3 tasks | 2 files |
| Phase 089 P02 | 6min | 3 tasks | 3 files |
| Phase 089 P03 | ~3h | 3 tasks | 35 files |
| Phase 091 P01 | 7min | 3 tasks | 10 files |
| Phase 091 P02 | 7min | 3 tasks | 7 files |
| Phase 091 P06 | 5min | 2 tasks | 5 files |
| Phase 091 P03 | 7min | 3 tasks | 6 files |
| Phase 091 PP05 | 7min | 3 tasks | 5 files |
| Phase 091 P04 | 5min | 3 tasks | 5 files |
| Phase 091 P07 | ~14min | 3 tasks | 2 files |
| Phase 091 P08 | ~20min | 3 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- (v2.8 roadmap): 8 phases (089-096) derived from 21 requirements; research A→G build order adopted with 2 polish riders sequenced after the extraction
- (v2.8 roadmap): whitelist enforcement (research "Phase D") folds into Phase 091 — shares the ToolContext construction site, NOT a separate phase
- (v2.8 roadmap): G-5 satisfied by Phase 089 (threads.py extraction lands FIRST, behavior-preserving, byte-identical SSE gate)
- (v2.8 roadmap): G-2 fires for Phase 094 (panel timeline) AND Phase 095 (chat-card unification) — sketch-before-plan mandatory
- (v2.8 roadmap): migrations renumber from real head 056+ (PRD's 125-139 reservation is stale fiction); deep_mode_metadata column dropped (no v2.8 consumer)
- (v2.8 roadmap): zero new dependencies — harness is ~80% composition of shipped task_service / ask_user_service / tool_dispatcher primitives; all SSE rides existing run:{run_id} stream
- (D-v2.8-01): v2.8 = harness + dual-mode only; Plugin Contract + super_admin/operator role tier deferred to v2.9 (lock on harness telemetry)
- (v2.8 mode-axis clarification, operator-raised): Deep/Harness is ORTHOGONAL to the existing `agent_mode` (General/Explorer). "Deep Mode" = `active_workflow_run_id IS NULL` (umbrella for General AND Explorer, unchanged); the HARNESS-05 whitelist guard is a no-op in Deep Mode so Explorer's 6-KB-tool set is untouched when no workflow runs. Phase 089 extraction MUST preserve the Explorer branch byte-identically (UAT covers it); Phase 092 owns the small UX call of what the General/Explorer selector does DURING an active workflow. No architectural conflict.
- (v2.7 roadmap): 6 phases derived from 22 requirements; research consensus confirmed build order
- (v2.7 roadmap): G-5 mandated -- threads.py extraction is Phase 083, prerequisite for all new tools
- (v2.7 roadmap): G-2 fires for Phase 087 (Panel UI) -- sketch-before-plan mandatory
- (v2.7 research): ask_user requires Redis pub/sub for cross-worker safety (asyncio.Event fails with WORKER_COUNT=2)
- (083-03): Kimi thinking filter uses state-machine with _in_think_block; provider-gated on moonshot + deepseek
- (083-03): _SINGLE_MODEL_PROVIDERS frozenset classifies provider tiers for title gen model routing
- (087-01): Sheet bottom-sheet hand-authored on installed @radix-ui/react-dialog (side=bottom) — NOT npx shadcn add sheet (avoids vaul); zero new dependency (A3)
- (087-01): --warning-foreground darkened to deep-midnight ink (240 60% 8%) for ≥4.5:1 on amber bg (UI-SPEC), rather than lightening text
- (087-01): WorkspaceFileContent is a discriminated union over storage_type (inline|bucket) so Plan 03 preview routing is type-safe
- (087-01): Wave 0 panel tests are GREEN-only it.todo() contracts (52) mapped to VALIDATION per-req map; each downstream plan flips its own todos to live tests
- (087-03): ShikiCode reused for code preview (A1) — UI-SPEC's literal react-syntax-highlighter is superseded; RSH stays unused, no new dep
- (087-03): CsvTablePreview is a hand-rolled quote-aware splitter (no CSV lib, D-01); malformed/ragged/≥2000-rows/>256KB all short-circuit to the calm fallback before DOM build (T-087-07)
- (087-03): fileFlash added as an index.css @keyframes + .animate-fileFlash utility (prefers-reduced-motion guarded), mirroring brandPulse/checkPop — no Tailwind config change
- (087-04): unified-diff parsed CLIENT-SIDE via pure parseUnifiedDiff (no diff lib, SC#3) — backend already emits the difflib string; Unicode minus (U+2212) for del signs per UI-SPEC
- (087-04): shared DiffLines presentational renderer (5th file beyond the plan's 4) so VersionDiff in-column diff + DiffExpandOverlay wide diff share one render path; ⤢ overlay reuses the SAME parsed payload — no second fetch (D4)
- (087-04): VersionDiff defaults to latest-two (Compare v{n-1}<->v{n}); red-base/green-target pills carry text+aria (base/target version N), not color-only
- (087-05): A2/Pitfall-1 resolved concretely — Send Answer gated on (pick OR type) AND run_id!=null; pure-SSE prompt (no run_id) triggers reconcile-if-missing + shows "Preparing…"; NEVER POSTs without a reconciled run_id (would 404)
- (087-05): answer flow is optimistic-then-reactive — optimistic green .answered on 200, then ask_user_response SSE removes the prompt from the store → card unmounts + run un-pauses (D4)
- (087-05): seam mode signal reuses per-message runStatus==='streaming' (live=pointer/cue, terminal/rehydrated=card) — no new global state; D-05 single source of truth (live in panel, history in transcript)
- (087-05): SeamCard closes the documented ask_user reload gap (answered Q&A in chat on reload) — the OPEN FOLLOW-UP the Phase 086 surface note flagged
- (087-05): seam open handlers (onSeePanel/onOpenPanel) left as optional unwired props — Plan 02 panel shell owns the panel-open action and wires them; renderers degrade to no-op click until then
- (087-05): MessageItem seam mounts are PURELY additive (102 insertions / 0 deletions); RunCard call shape preserved; BUG-260529-02 surface untouched (G-5)
- (087-02): seam open handlers wired via a module-level event bus (panelOpenSignal — subscribeOpenPanel/requestOpenPanel) instead of re-plumbing onSeePanel/onOpenPanel through MessageList→ChatArea; keeps the G-5 MessageItem change to 6 ins / 0 del and carries no thread data (PANEL-06 / T-087-17 safe)
- (087-02): WorkspacePanel state machine — header button CYCLES open→rail→hidden→open; ⌘./Ctrl+. TOGGLES open↔hidden; rail icon / seam pointer EXPANDS to open
- (087-02): push/split grid lives INSIDE WorkspacePanel's own aside (Pitfall 3 — live ChatLayout is flex not grid); ChatLayout mount is one additive sibling gated on activeView==='chat' (6 ins / 0 del)
- (087-02): mobile (<768px) detected via window.innerWidth + resize (not matchMedia — jsdom-safe); body renders inside the Plan-01 Radix-Dialog Sheet
- (087-02): the fixed-order 'Pending question' slot is satisfied by PendingAskStack PINNED at the very top (087-05 contract), not an extra empty accordion section — avoids the empty-tax the short-circuit forbids
- (087-06): the chat|panel split is now ONE ChatLayout-level CSS grid (1fr | clamp(300-420px)/52px/0) — Pitfall-3 self-referential aside-grid (where 30% collapsed to its 300px floor) REVERSED in favor of panel-shell.md D1; the panel column resolves against the real row width so 1fr+clamp always sums to the row → zero horizontal overflow + flush-right panel + chat centers in its own 1fr column (closes gaps 1 & 7)
- (087-06): WorkspacePanel is now CONTROLLED (state/onCycle/onExpand/onHide props); the open/rail/hidden state machine, the ⌘./Ctrl+. listener, and subscribeOpenPanel(expand) lifted UP to ChatLayout so the persistent chat-header toggle + the seam pointer drive the same state (closes gap 3 — hidden panel reopenable by mouse)
- (087-06): pulsing-amber-dot ask_user-pending indicator on the chat-header toggle computed in ChatLayout via useAskUserPrompt(useViewingThread()) — workspacePending = pending.length>0 && state!=='open'; motion-safe:animate-pulse honors prefers-reduced-motion, no new store (closes gap 4 / PANEL-01)
- (087-06): DevTwoPaneMock import+mount removed from production App.tsx (file retained for dev); T-087-06-01 info-disclosure mitigated (closes gap 2)
- (088-01): vitest-axe (NOT jest-axe) wired as the structural-a11y matcher — runner is Vitest 4.1.0; D-13's jest-axe was the wrong binding (RESEARCH correction #2)
- (088-01): global :focus-visible ring added to index.css @layer base via zero-specificity :where(...) — a floor, not an override (components with their own focus-visible:ring-* still win)
- (088-01): A11Y-01/02 structurally GREEN + axe-gated on all 8 panel components (89/89), no component restructure needed (no D-09 SEED); contrast/focus-ring real-verification deferred to Plan 05 Chrome MCP Lighthouse (Pitfall 5)
- (088-02): cross-provider eval script switches provider via the per-request MessageCreate.provider/model override (threads.py:1285), NOT a persistent user_settings UPDATE — measures the REAL active_system_prompt (Pitfall 2) with zero global-state mutation
- (088-02): scripts/eval_cross_provider.py is the SEED-034 fold-gate evidence source (D-05) — greppable EVAL_ROW/EVAL_SUMMARY scoreboard; Plan 04 re-runs it before/after a text-only prompt change to prove +1 failing model passes / 0 strong regressions. Authored here, run LIVE in Plans 04/05 (operator backend) — this is the v2.8 harness eval seed (EVAL-01)
- (088-04): SEED-034 VERDICT = FOLDED — text-only universal write_todos + ask_user directive kept at 2f6e2523; AFTER 6x4 eval = condition-b MET (OpenAI/Anthropic/OpenRouter multi-tool write_todos FAIL->PASS) + condition-c MET (zero fold-attributable regression) + condition-a git-diff-proven text-only (TASK_TOOL untouched, no tool_choice forcing)
- (088-04): eval PROVIDERS extended 4->6 (operator-approved, additive) — native deepseek + moonshot added as the weak-model fold-gate targets; Google is a constant 404 confound; per-provider task/ask_user gaps + Google secondary-model 404 deferred to v2.8 (eval script is the v2.8 harness seed, D-08)
- (088-05): D-17 gemini-3 thought_signature CLOSED-as-verified — Google-axis deep flow + multi-tool rounds CLEAN (zero 400); transient 088-04 Google 404 is a SEPARATE secondary-model routing artifact (v2.8 CF-01)
- (089-02): eval extended to native-7 — zhipu/glm-4-flash + minimax/minimax-m2.7 appended to PROVIDERS + ZHIPU/MINIMAX_API_KEY presence checks (is_secret, presence-only); choices auto-derive, localhost hard-gate untouched (D-089-09)
- (089-02): byte-identical SC#3 proof = capture_run_events (XRANGE run:{run_id}) + normalize (mask message_id/run_id, drop captured_at) + diff_event_streams ([] == PASS); operator runbook captures BEFORE baseline against the pre-move loop in Wave 1, AFTER diff in Plan 04 (D-089-08)
- 089-03 (G-5 verbatim move): agent loop lifted byte-identically from threads.py into agent_loop.run_agent_loop; _shielded_finalize + _terminal_status classifier STAY; zero net regression vs baseline (identical 102-failure set)
- 089-03: module-level loop helpers + _reconstruct_history moved to agent_loop.py and re-imported into threads.py (cycle-free, one canonical copy); AgentLoopResult gained persist_system_warnings + run_agent_loop gained timeout_ctx/result_sink kw-only params (Rule-3 structural, behavior-preserving)
- (091-01): harness.py PhaseConfig fields FINALIZED — input_keys (programmatic), model/temperature (llm_single), wall_clock_seconds+model (llm_agent/batch), merge_strategy Literal[concat,concat_numbered], ask_user options+timeout; discriminator/union/extra=forbid/Literals LOCKED; no final_output (D-11)
- (091-01): Wave-0 scaffold = 7 test files + 5 shared fixtures (mock_asyncpg_pool UPDATE-recorder, fake_redis pub/sub+XADD events log, make_tool_context w/ phase_whitelist, make_run_context, build_workflow_definition/four_seed_defs); 22 live anchors green, 27 skipped contracts each name owning plan; ctx factory uses SimpleNamespace so phase_whitelist exists pre-Plan-06
- (091-02): harness_engine.run_workflow drives phases in phase_index order via PHASE_TYPE_REGISTRY seam (LLM never picks next); 2-phase write delegated to db/workflows.py (mark_phase_active before work, complete_phase status+output ONE atomic UPDATE after durable); crash leaves phase active (propagates, never completed); final phase output IS chat message (D-10, no synthesis LLM call)
- (091-02): reachability lint edge model links by phase_index VALUE +1 (not sorted position) so non-contiguous gaps genuinely orphan/strand terminal; 4 seeds lint clean; run-keyed workflow_phases reads use workflow_run_id (42703 guard)
- (091-06): HARNESS-05 whitelist guard at the single dispatch_tool() entry (above _TOOL_REGISTRY.get, below all provider branches) — out-of-phase tool returns the D-04 guiding ToolResult + D-06 tool_refused audit; phase_whitelist=None (Deep Mode) is a literal no-op so Explorer/General stay byte-identical (zero provider-branch edits)
- (091-06): TOOL-05 apply_tool_budget = D-05 layer-1 whitelist filter + per-provider max_tools cap (whitelist tools always retained, soft ceiling yields); max_tools added to ModelCapability (absent=no cap), Google rows=16 (SEED-035). NOT wired into any Deep-Mode get_tools() call site — harness executor (Plan 03) is sole caller, so Deep Mode incl. Google is byte-identical (SC#2)
- 091-03: 5 phase-type executors wrap shipped substrate (run_task_sub_agent / _stream_one_iteration / ask_user pub-sub / programmatic registry); both D-05 whitelist layers wired for LLM-agent phases; split_topic is pure/idempotent; system_prompt_override additive keyword-only on run_task_sub_agent (None=byte-identical)
- 091-05: validation gates (4 closed-registry kinds, all fail-closed) + bounded retry (≤3 attempts, never loops — SC#3) + consecutive-identical short-circuit; on_failure routing fail_run(keep partials+plain reason D-07)/skip_to_phase(D-09)/unknown→fail_run(fail-safe); wall-clock TimeoutError drives same routing (D-12); ctx.retry_feedback PRODUCER (Plan 03 consumes, 07-T2 round-trip); caps sized from existing knobs (Explorer=8 step, 300×8=2400 wall-clock)
- 091-04: resume sweep claims each stranded run via claim_run CAS before re-driving run_workflow (multi-worker safe, WORKER_COUNT=2)
- 091-04: resume_pending_prompt re-emits inside a shared _subscribe_and_block on_subscribed hook -> subscribe-before-emit is structural (Pitfall 2)
- 091-04: answered-vs-pending detection mirrors panel.py /pending raw scan inverted (role=system ask_user_response row by tool_call_id); answered -> skip re-ask

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 089 (G-5 extraction) is the highest-risk-if-done-wrong phase of v2.8 — a careless "while-I-am-in-here" cleanup re-opens the entire 075.x cross-provider cascade. Acceptance bar is byte-identical SSE per provider (eval + E2E GREEN before AND after), NOT just "tests pass". Carry forward EVERY per-provider round-trip fix verbatim (named checklist in VERIFICATION).
- Phase 091 highest-risk implementation details: the 2-phase write (mark active before work, completed only after durable output) and the `ask_user` resume re-subscription (re-SUBSCRIBE + re-emit pending prompt on startup sweep). Resumability is the trickiest correctness surface.
- AnyIO threadpool live budget (CONC-01 / Phase 096): verify `anyio.to_thread.current_default_thread_limiter().total_tokens` before sizing `llm_batch_agents max_parallel` defaults — PRD cites ~200, AnyIO default is 40, project lifted it; exact current value unknown without a live check.
- Per-provider eval model list (EVAL-01 / Phase 096): needs a curation pass to current model IDs per native provider (model names are representative of provider class, not pinned).
- Phase 094 (panel) + Phase 095 (chat-card) require sketch approval (G-2) before planning can begin.

### Phase 086 surface note — BUG-260528-01 fix (2026-05-28, commit 7d2b3d2)

Surfaced for any reconcile/snapshot/message-list change (relevant to Phase 089 extraction + Phase 094 panel reconcile):

- **What was fixed:** `GET /threads/{id}/snapshot` and `/messages` now filter `role='system'` rows (`.neq("role","system")`). Phase 085's `ask_user` tool persists prompt/response as durable `role='system'` rows (migration 048), but `MessageResponse.role` is `Literal["user","assistant"]` — serializing a system row raised `ResponseValidationError` → **500, thread won't load**. Regression guard added in `test_075_snapshot.py`.
- **Constraint going forward:** any reconcile/snapshot/message-list change MUST preserve this filter, or threads with ask_user history 500 on load again. The `panel.py` `/pending` query (raw asyncpg, scans system rows directly) is the separate path and is unaffected.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260529-0sc | Fix Phase 086 WR-04: persist panel todo/task Maps to localStorage write-path (closes the sole blocking gap from 086-VERIFICATION.md) | 2026-05-28 | 62c1cf0 | [260529-0sc-fix-phase-086-wr-04-persist-panel-todo-t](./quick/260529-0sc-fix-phase-086-wr-04-persist-panel-todo-t/) |
| 260529-1wb | Fix BUG-260529-01: write_todos crashes on stringified `todos` arg — json.loads coercion + isinstance guards so weak/OpenRouter models get a self-correcting error instead of a crash loop (RED→GREEN regression test) | 2026-05-28 | c756522 | [260529-1wb-fix-bug-260529-01-write-todos-crashes-on](./quick/260529-1wb-fix-bug-260529-01-write-todos-crashes-on/) |
| 260530-wjp | Fix cross-provider native-tools: deepseek/moonshot/minimax/zhipu infer native_tools=True on registry-miss model ids (was big-3 only) → real tool calls instead of narrated/fabricated text (closes zhipu/minimax tool-calling + workspace breakage); +`<think>` strip for minimax/zhipu; canonical newest-first model lists (DB). Verified live: minimax-m2.7 real workspace_write + zhipu glm-4-plus real search_documents | 2026-05-30 | d87047c1 | [260530-wjp-infer-native-tools-for-deepseek-moonshot](./quick/260530-wjp-infer-native-tools-for-deepseek-moonshot/) |
| 260530-wvt | Fix title-gen stuck on 'New Chat': strip `<think>`, derive title from user message (not bare 'New Chat'), bump Google budget 60→160. Root cause = token-budget starvation of reasoning models (NOT wrong model name). Verified live across deepseek/moonshot/minimax/zhipu/google — all return sensible titles. Closes BUG-260527-01 + CF-01 C1 (was earmarked Phase 093) | 2026-05-30 | 80f255c6 | [260530-wvt-fix-title-gen-stuck-on-new-chat-strip-th](./quick/260530-wvt-fix-title-gen-stuck-on-new-chat-strip-th/) |
| 260531-00x | Add reportlab==4.2.5 to Dockerfile.sandbox — sandbox had no PDF-WRITING lib (pypdf only reads) so "generate a PDF report" prompts failed. Bumped CLAUDE.md image tag 075.1→075.1.1. Operator must rebuild image + bump SANDBOX_IMAGE (new chats only). Deeper gap (managed package set + agent pip-install-don't-give-up) seeded separately | 2026-05-31 | 7492f1eb | [260531-00x-add-reportlab-to-sandbox-image-pdf-writi](./quick/260531-00x-add-reportlab-to-sandbox-image-pdf-writi/) |

## Deferred Items

### v2.8 in-flight deferrals

- **SEED-047 (resume ctx missing inputs/model)** — planted 2026-05-31 at 091-08 gap closure (091-REVIEW WR-01/WR-02). Resume context omits run `inputs` (top-level `programmatic` inputs lost on resume → empty splits) and `model`/`user_settings` (resumed `llm_*` phases run with `model=""`). Not fixable in 091 (no `INSERT INTO workflow_runs` in `backend/app`). Deferred to **Phase 092** (dual-mode + Continue owns run creation). Re-open trigger: Phase 092 run-creation persists `workflow_runs.inputs` + `model` → rehydrate into resume ctx; **Phase 096 EVAL-02 (live kill-and-resume)** is the proof gate. Until then, resumed LLM / top-level-input phases are a known live-resume limitation (deterministic unit proof for resume mechanics stands).

### Acknowledged at v2.7 close (2026-05-30)

27 open artifact-audit items acknowledged and deferred at v2.7 milestone close (operator chose "Acknowledge all & proceed"). None block the shipped build — the milestone was verified end-to-end by the Phase 088 cross-cutting capstone.

| Category | Item | Status |
|----------|------|--------|
| UAT gap | 085-HUMAN-UAT.md (5 operator-only scenarios) | Rolled forward — operator-only rows |
| UAT gap | 087-HUMAN-UAT.md (6 operator-only scenarios) | Rolled forward — operator-only rows |
| UAT gap | 083 / 084 / 086 / 087-UAT (0 pending scenarios) | Cosmetic — status fields not flipped |
| Verification | 083-VERIFICATION.md (human_needed) | Accepted — operator UAT approved in-phase |
| Verification | 085-VERIFICATION.md (human_needed) | Accepted — operator UAT approved in-phase |
| Quick tasks | 11 pre-GSD micro-tickets (260322..260412) | Unknown — predate GSD (carried since v2.5) |
| Quick task | 260522-gdg-google-15-iter-loop-diagnostic | Diagnostic note only |
| Quick tasks | 260529-0sc, 260529-1wb | Actually DONE (commits 62c1cf0, c756522) — audit false-positive |
| Dormant seeds | SEED-002 / SEED-003 / SEED-004 / SEED-005 | Dormant — long-deferred future milestones |

Plus v2.7-specific deferrals carried with re-open triggers: **SEED-037** (in-panel office/PDF/PPTX viewing + working download — viewing → v2.9 file_preview plugin; download wire-up → standalone `/gsd:quick` in v2.8), **SEED-038** (chat-vs-panel artifacts unification), **SEED-039** (panel reliability / fast-switch race), **BUG-260527-01** (title-gen live-verify on DeepSeek/Moonshot/Google — folded into 083 but unverified → CF-01 in Phase 089), **BUG-260529-02** (chat-tool-card unification → CHAT-04 / Phase 095).

### Carried forward from v2.6 milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Phase | 082.5 Error Handler Foundation (SEED-026 slice) | Deferred to v2.7+ | v2.6 close |
| Dormant seed | SEED-002 Skill Studio Milestone Preparation | Dormant | v2.5 |
| Dormant seed | SEED-003 Deployment Flexibility & Install/Config UX | Dormant | v2.5 |
| Dormant seed | SEED-004 Org / Department / Role Multi-Tenancy | Dormant | v2.5 |
| Dormant seed | SEED-005 Document Management Capabilities | Dormant | v2.5 |
| Quick tasks | 11 pre-GSD micro-tickets (260322..260412) | Unknown | v2.5 |
| UAT cosmetic | 15 HUMAN-UAT status fields not flipped | Cosmetic only | v2.6 close |
| Verification | 10 verification gaps with project approval | Accepted | v2.6 close |

## Session Continuity

Last session: 2026-05-31
Stopped at: Phase 092 Plan 01 — Tasks 1-2 committed (migration 063 @35bbfade, scaffolds+verify_092.sql @2e8106f0); BLOCKED at Task 3 (operator pastes migration 063 into Supabase SQL editor, runs verify_092.sql, then `bash scripts/regenerate-full-schema.sh`, then signals "applied")
Resume file: .planning/phases/092-dual-mode-wiring-continue-button/092-01-PLAN.md

**Planned Phase:** 092 (dual-mode-wiring-continue-button) — 4 plans — 2026-05-31T11:04:01.842Z

**Plan 092-01 — IN PROGRESS (paused at blocking checkpoint):**
- Task 1 ✅ migration 063_dual_mode_continue.sql (commit 35bbfade)
- Task 2 ✅ 3 Wave-0 pytest scaffolds + verify_092.sql; suite exits 0 (3 anchors pass / 12 contracts skipped) (commit 2e8106f0)
- Task 3 ⏸ checkpoint:human-verify (blocking) — operator applies migration 063 + regenerates full-schema.sql. Resume signal: "applied". Full SUMMARY.md written after the checkpoint resolves.
