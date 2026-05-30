---
gsd_state_version: 1.0
milestone: v2.8
milestone_name: Harness Engine & Workflow Mode
status: phase_complete
stopped_at: Phase 090 complete (VERIFICATION passed — schema + RLS + config models)
last_updated: "2026-05-31T00:00:00.000Z"
last_activity: 2026-05-31 -- Phase 090 shipped (migrations 056-060, harness.py, 8/8 live-DB verify)
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 10
  completed_plans: 7
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-30 after v2.7 close)

**Core value:** The agent acts as an AI colleague -- it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** Phase 090 COMPLETE — next is Phase 091 (harness engine)

## Current Position

Phase: 090 (Harness Schema + RLS + Config Models) — ✅ COMPLETE (VERIFICATION passed)
Plans: 3/3 shipped (090-01 models+tests, 090-02 migrations 056-059, 090-03 manual apply + live verify); +migration 060 (code-review WR-01 fix)
Status: Phase 090 shipped — substrate live (4 tables + threads.active_workflow_run_id), RLS + immutable-on-publish + INSERT-only audit all confirmed against the live local DB; 8/8 verify_090_run.sql blocks PASS; harness.py Pydantic models 8/8 unit tests pass. full-schema.sql regenerated.
Scope: HARNESS-01..07 (state-machine workflow runtime, 5 phase types, validation gates, resumable runs, audit, seed templates) + MODE-01/02 + CONT-01 (Continue) + PANEL-08/09 + A11Y-03 + EVAL-01/02 + CONC-01 + TOOL-05 + FOUND-03 (G-5 extraction) + CF-01 (carry-forward sweep) + 2 polish riders (CHAT-04 chat-card unification, PARITY-01 Anthropic parity). PLUGIN-01..03 + `super_admin`/operator role tier DEFERRED to v2.9. See PROJECT.md D-v2.8-01.
Next: `/gsd:discuss-phase 091` — the harness engine: state-machine runtime over the 090 substrate, 5 phase executors, validation gates, the HARNESS-05 tool whitelist. Phase 091 consumes workflow_definitions/runs/phases + the harness.py PhaseConfig models (field shapes are provisional in 090 — finalize against the engine here).
Phase order + dependencies: 089 (extract, BLOCKING, ships first) ‖ 090 (schema, parallels 089) → 091 (engine + 5 types + gates + whitelist; whitelist folds in here) → 092 (dual-mode + Continue) → 094 (panel timeline). 093 (Anthropic parity) after 089. 095 (chat-card) after 089. 096 (eval + verify) last, after all features.
G-5: SATISFIED by Phase 089 (`threads.py` 3,186 LOC extraction).
G-2 FIRES: Phase 094 (panel phase timeline) AND Phase 095 (chat tool-card unification) — `/gsd:sketch` before spec/plan; operator-approved mockup is the acceptance bar.
SC#10 4-axis UAT (cross-provider × multi-tool × parallel-thread × long-message) baked into success criteria for 089, 091, 092, 093, 094, 095, 096.
Carry-forwards into v2.8 (verify at kickoff via CF-01 in Phase 089): BUG-260527-01 title-gen (DeepSeek/Moonshot/Google, fixed-but-unverified), Google secondary-model 404, download-link payload. 087 panel deferrals SEED-037/038/039 (037 download → standalone `/gsd:quick`).
Last activity: 2026-05-30 -- Phase --phase execution started

Progress: [████████░░] 75%

## Performance Metrics

**Velocity:**

- Total plans completed: 29 (v2.7)
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

Last session: --stopped-at
Stopped at: Phase 090 context gathered
Resume file: --resume-file

**Planned Phase:** 090 (harness-schema-rls-config-models) — 3 plans — 2026-05-30T20:13:36.774Z
