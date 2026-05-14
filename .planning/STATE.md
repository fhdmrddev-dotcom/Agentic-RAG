---
gsd_state_version: 1.0
milestone: v2.6
milestone_name: Milestone Context
status: Ready for next phase (recommend inserting 071.1 before 072)
stopped_at: "Phase 071.1 context gathered (D-071.1-01..06 locked: threadpool sweep on /reextract only, defense-in-depth Docling timeout, PyMuPDF auto-fallback on timeout only, friendly real fixture)"
last_updated: "2026-05-14T20:35:53.748Z"
last_activity: 2026-05-14 — Phase 071 close-out + Plan 04 Rule-1 inline fixes (commit 9116c2b)
progress:
  total_phases: 17
  completed_phases: 5
  total_plans: 14
  completed_plans: 15
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-12) + .planning/PRDs/v2.6.md (scope brief, locked 2026-05-10, signoff 2026-05-12) + .planning/prd-reset/DECISIONS.md (D-PRD-01..15 locked)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** Phase 071 closed partial (SC#1 RED → carries to 071.1); next phase candidate 072 (Multimodal Lift) or insert 071.1 first.

## Current Position

Phase: 071 — CLOSED PARTIAL (4/5 SCs green, SC#1 carry-forward → 071.1)
Plan: All 4 plans complete + 071.1 scope captured in 071-VERIFICATION.md
Status: Ready for next phase (recommend inserting 071.1 before 072)
Last activity: 2026-05-14 — Phase 071 close-out + Plan 04 Rule-1 inline fixes (commit 9116c2b)

## PRD-reset outputs (committed)

- `.planning/research/milestone-shaping-2026-05-09.md` — 797-line synthesis (commit `d7af056`)
- `.planning/research/recovered/` — 15 recovered strategy MDs copied into project tree (commit `d7af056`)
- `.planning/prd-reset/PLAN.md` — meta-phase plan (commit `0f0153c`, fixes `29295a0`+`a226ab4`)
- `.planning/prd-reset/DECISIONS.md` — 15 locked D-PRD-NN ADRs (commit `fa63434` v1.0; +D-PRD-13/14/15 at signoff 2026-05-12)
- `.planning/prd-reset/PRD-TEMPLATE.md` — 16-section template v2 (commit `fa63434`+`29295a0`)
- `.planning/prd-reset/MIGRATION-RESERVATIONS.md` — claimed migration ranges 039-124 (commit `fa63434`)
- `.planning/prd-reset/SUMMARY.md` — Plan 09 consistency + signoff (commit `a226ab4`)
- `.planning/PRDs/v2.6.md` (560 lines, commit `29295a0`) + TOKEN-COL-01 added at signoff
- `.planning/PRDs/v2.7.md` (550 lines, post-signoff addition 2026-05-12) — Agent Workspace + Harness Engine + Plugin Contract; migrations 125-135 (reserved 125-139); 8 §13 Q-IDs surfaced including Q-v2.7-07 → D-PRD-16 candidate (Plugin Contract codification)
- `.planning/PRDs/v3.0.md` (545 lines, commit `29be513`) + accessibility theme added at signoff
- `.planning/PRDs/v3.1.md` (604 lines, commit `29be513`) + accessibility theme added at signoff + D-PRD-13/14 → D-PRD-14/15 renumbering
- `.planning/PRDs/v3.2.md` (626 lines, commit `29be513`) + Q-v3.2 footer fix at signoff
- `.planning/PRDs/v3.3.md` (584 lines, commit `29be513`) + D-v3.2-NN → D-PRD-02+D-PRD-14 + explicit POST /api/v1/skills/{id}/run route
- `.planning/PRDs/v3.4.md` (552 lines, commit `29be513`) + Q-v3.4-09 D-PRD-13 claim retracted

## Signoff decisions captured (2026-05-12)

- (A) 6 PRDs approved as authored
- (B) TOKEN-COL-01 added to v2.6 §3 Theme F + §4 Active row (pure observability, no caps)
- (C) Accessibility WCAG 2.1 AA: small lift across v3.0 Theme I + v3.1 Theme L
- (D) Compliance: customer-driven (SOC 2 / ISO 27001 / HIPAA only when funded by an Enterprise-tier contract per D-PRD-10); GDPR DPA pre-emptive at v3.2 close (cheap, contract + tech checklist)

## v2.5 archive (historical)

v2.5 Deployment Strategy shipped + archived 2026-05-09. Phases 058-067.5 closed. Archives at `.planning/milestones/v2.5-phases/`, `v2.5-REQUIREMENTS.md`, `v2.5-ROADMAP.md`.

## Outstanding before v2.5 close (historical — superseded by archive)

## Outstanding before v2.5 close

All gate-blocking work is now closed. One administrative deferral remains, intentional and documented:

- **Phase 064: Validation Harness — DEFERRED (intentional).** Originally scoped Chrome MCP scripts for scenarios E (tab-switch mid-stream), F (refresh mid-stream), G (Stop button), H (thread navigation), and multi-tab sync. Scenarios E + F + H were validated organically by Phases 067.3 / 067.4 / 067.5 user-driven UAT (5/5 GREEN cycles for empty-thread-until-refresh + cross-thread switch). G + multi-tab sync remain partially deferred to a future side-phase if ever needed. See ROADMAP entry for full coverage table. NOT a v2.5 close blocker.
- **Code review (optional gate, non-blocking):** 067.1, 067.2, 067.3, 067.4, 067.5 have no `*REVIEW*.md` (the orchestrator-driven UAT scoreboards substituted for code review on those tightly-scoped polish phases). Older phases (058–063.1, 065, 066) do have REVIEW.md. Acceptable per Phase 063 / 067 precedent — no action required for v2.5 close.
- **Carry-forward seeds (NOT v2.5 scope):** (a) claude-haiku-4-5-20251001 `max_tokens=65536 > 64000` cap mismatch (surfaced during 067.5 cycle 5; Resume worked; worthy of a separate seed); (b) NR-067.2-11/12 OpenRouter Kimi 2.5 + MiniMax 2.7 synthetic-timeout protocol (user-deferred at 067.4 UAT; OpenRouter creds present, just exercise the protocol later).

Next action: `/gsd:complete-milestone v2.5` — all gate-blocking work closed. After milestone close, plant carry-forward seeds (claude-haiku max_tokens cap; OpenRouter Kimi/MiniMax synthetic-timeout protocol; deferred-items.md D-065-01-DEFER-2 test_059 fixture-cleanup) before starting next milestone.

## Deferred Items

Items acknowledged and deferred at v2.5 milestone close on 2026-05-09. Each item was reviewed against the ROADMAP closure narratives; none contradict the closure annotations or block milestone completion. Surfaced by `gsd-tools.cjs audit-open` at close time (31 items total).

### UAT status fields not flipped after cross-phase closure (10)

These phases closed via the documented cross-phase chain (see ROADMAP top-section closure annotations + the cross-phase entry in this file's "Recent Completed Phases"). The HUMAN-UAT.md frontmatter `status` fields were not updated when downstream phases closed the gate-blocking rows. All 10 show `0 pending scenarios` — no actionable UAT work remaining.

| Phase | UAT file | Recorded status | Reality |
|-------|----------|-----------------|---------|
| 062 | 062-HUMAN-UAT.md | partial | Closed; 062 verified passing during v2.5 chain |
| 063.1 | 063.1-HUMAN-UAT.md | partial | Closed (project-level approval per Phase 063 precedent) |
| 066 | 066-HUMAN-UAT.md | green | Closed; UAT was already green/approved at close |
| 067 | 067-HUMAN-UAT.md | partial | Closed (project-level approval) |
| 067.1 | 067.1-HUMAN-UAT.md | green-with-note | Closed (SC#3 substantive 5/5 / strict 3/5) |
| 067.2 | 067.2-HUMAN-UAT.md | blocked | Closed via 067.3 / 067.4 / 067.5 cross-phase chain |
| 067.3 | 067.3-HUMAN-UAT.md | gaps_blocking | Closed via 067.4 R-3 GREEN |
| 067.4 | 067.4-CLOSING-UAT-RUNBOOK.md | unknown | Runbook artifact, not a UAT scoreboard |
| 067.4 | 067.4-HUMAN-UAT.md | gaps_blocking | Closed via 067.5 Branch D-3 fix (Row 11 GREEN) |
| 067.5 | 067.5-02-CLOSING-UAT.md | unknown | Closing UAT — gate met, 5/5 cycles GREEN |

### Verification gaps (4)

All four are `human_needed`-status verifications on phases that closed with project-level approval (Phase 063 precedent: project_level_approval `approved` is sufficient closure when human-driven verification is logistically gated). None blocked phase closure.

| Phase | File | Note |
|-------|------|------|
| 061 | 061-VERIFICATION.md | Run-Backed Streaming backend; closed with project approval |
| 063 | 063-VERIFICATION.md | Frontend Stream Decoupling; closed with project approval |
| 063.1 | 063.1-VERIFICATION.md | Gap closure for 063; closed with project approval |
| 067 | 067-VERIFICATION.md | Frontend Streaming-UX Fix; closed with project approval |

### Quick tasks — historical micro-tickets predating GSD (11)

These pre-date the GSD planning workflow. Most are `unknown` status (the tracker has no link back to whether they shipped). Several were almost certainly resolved during v2.2 / v2.3 / v2.4 milestones but the quick-task tracker was never reconciled. NOT in v2.5 scope; should be re-triaged at next milestone planning if any still reproduce.

- 260322-26g — improve tool-call display for ls/tree/grep
- 260328-v6n — investigate duplicate folder behavior
- 260328-wqj — folder-scoped chat returning results bug
- 260328-x6n — folder not created when pressing (`completed` per tracker)
- 260404-vel — streaming cursor bug + meaningful indicator
- 260405-rgy — folder public visibility files
- 260405-s1e — hide toggle-global from non-owners
- 260407-vqw — context window management review
- 260411-wj5 — skill file upload bug
- 260412-dqu — four issues in skills API
- 260412-jnc — import skill 202 BackgroundTask

### Dormant seeds — intentional future work (6)

These are explicitly future-looking ideas, planted in earlier milestones and confirmed dormant by frontmatter. They surface when their `trigger_when` conditions fire, not before. NOT v2.5 scope by design.

- SEED-002 — Skill Studio Milestone Preparation
- SEED-003 — Deployment Flexibility & Install/Config UX
- SEED-004 — Org / Department / Role Multi-Tenancy
- SEED-005 — Document Management Capabilities (M-Files-aligned subset)
- SEED-006 — Multimodal Extraction Quality (Phase 35/36 Follow-up)
- SEED-007 — App-level Streams Provider

(SEED-008–014 also exist as `planted` status; not flagged by audit because audit only counts strictly `dormant`. All carry-forwards captured.)

## Recent Completed Phases

### Phase 065: Skills Test Infrastructure Repair (Complete 2026-05-09)

- VERIFICATION 4/4 must-haves verified (re-verified after Plan 065-03 gap closure); combined skills test run reports 26 passed / 0 failed / 0 skipped / 0 xfailed
- 065-01 renamed `create_streaming_chat` → `create_adaptive_streaming_chat` patch targets across 11 sites + tuple-wrapped 19 fake returns + added `CallingMode` import; 065-02 fixed 3 export-side assertion drifts (slug-prefixed bundle layout) → 15/15 pass; 065-03 migrated 11 tests to canonical Phase 063 POST→GET-stream pattern using `_build_mock_supabase()` + per-test `thread_id` fixture (closes BL-01 INSERT-id mock + WR-01 SSE-on-POST staleness + WR-02 THREAD_ID singleton + IN-01 stale assertion strings)
- 058 binding gate (`test_cross_tab_unblocked_during_sse`) green; 059 suite preserves pre-Plan-01 baseline (one pre-existing `test_normal_stream_unchanged: Event loop is closed` failure verified pre-existing on `fa1e327` base via git-stash round-trip — NOT a Phase 065 regression; deferred to a future test-infra phase per `deferred-items.md` D-065-01-DEFER-2)
- No production code touched. Code review (post-execution, depth=quick) clean (0 blockers / 0 warnings / 0 info). Plan-checker passed on iteration 2 after one targeted revision (TERMINAL_TYPES doc fix + mid-task checkpoint + scope-reduction guard + helper hardening)
- Skill Studio milestone (SEED-002) can now extend the green test foundation without inheriting broken patches

### Phase 066: Adaptive Run Timeouts & Lifecycle States (Complete 2026-05-06)

- VERIFICATION 7/7 must-haves verified; HUMAN-UAT `green` with `project_level_approval: approved` 2026-05-07
- Per-call timeout machinery + cancelled/timed_out lifecycle split shipped across 5 plans; live UAT 9m02s multi-step run (run_id `95e3447c-…`) verified Gap-006 closed at runtime — agent loop has no hard total cap, only per-LLM-call budgets that reset on tool-call boundaries
- SC#6 partial→green promotion delivered by Phase 067.1's Track A drain-into-queue fix in `backend/app/api/run_helpers.py`
- Closes Gap-006: "LLM agent stops mid-iteration on complex tool-call prompts; surfaces as `GeneratorExit` in LangSmith"

### Phase 067: Frontend Streaming-UX Fix (Complete 2026-05-07)

- All 5 plans landed; UX-067-01..05 all green via Chrome MCP (empty-paint, "Saving response…" thrash, refresh-required first-paint, redis-consumer log noise on tab cycle, tool-call iteration boundary surfacing)
- UAT `partial` / project-level `approved`; SC#6 4-of-5 sub-criteria green, LangSmith trace hygiene red → Gap-007 escalated to Phase 067.1

### Phase 067.1: Agent Streaming & Behavior Polish (Complete 2026-05-07)

- Track A drain-into-queue helper shipped in `run_helpers.py`; Phase 066 SC#6 promoted partial→green; SC#3 green-with-note (3/5 strict, 5/5 substantive)
- Closes Gap-007 (D-066-11 `stream.close()` invariant violated under synthetic-timeout) plus 3 deep-UAT findings: context-aware in-flight copy, system-prompt redesign for multi-step pipelines, skill-load tool card copy clarity
- 6 lived-experience gaps reported post-closure → escalated to Phase 067.2

### Phase 067.2 / 067.3 / 067.4: Streaming Render & Storage Fixes (cross-phase chain, Complete 2026-05-09)

- 067.2 closing UAT 7G/3R/3D (initial 2026-05-08) → escalated to 067.3 → 9G/2R/2D → escalated to 067.4 → 4G/1R/7D → Row 11 RED escalated to 067.5
- All gate-blocking rows closed downstream: R-1 (cross-thread switch via `messagesByThread` Map), R-2 (sandbox-output JS blob fetch+download via `frontend/src/lib/api.ts:downloadSandboxOutput`), R-2-IDOR (path-segment fence at `backend/app/api/sandbox_outputs.py:48-67` returns 404 to foreign user_id), R-2 long-TTL re-sign (60s TTL), N-01 (model→provider router at `backend/app/api/threads.py:949` honors `MODEL_CAPABILITIES[model]["provider"]`), R-3 (suggestion pills emit at threads.py:2487-2526 — Row 1 GREEN run `aa92f90e`), R-4 (active-thread tool-stage), R-5 (code-execution heartbeat / `code_output_line` SSE event), Row 11 (empty-thread-until-refresh closed via Phase 067.5 Branch D-3)
- User-deferred (non-blocking, NOT v2.5 scope): 067.2-11 + 067.2-12 OpenRouter Kimi 2.5 + MiniMax 2.7 synthetic-timeout protocol (creds present; carry-forward seed); 067.4 Rows 4–9, 12 user-retained ownership at UAT start (orchestrator delivered all UI-driveable rows)
- Per cross-phase closure rule (ROADMAP line 137 narrative), 067.2 + 067.3 + 067.4 close together once Row 11 GREEN — satisfied by 067.5

### Phase 067.5: Frontend Reconcile Fix (Empty-Thread-Until-Refresh) (Complete 2026-05-09)

- D-067.4-QUALITY-01 5/5 lived-experience cycles GREEN — Row 11 empty-thread-until-refresh repro closed (user-driven Plan 02 UAT, all 4 threads rendered without F5 across 5 consecutive cycles)
- Branch D-3-CLEAR-WIPES-STREAMING-BUCKET fix in `frontend/src/hooks/useMessages.ts:572-590` — `clearMessages` now refuses to wipe a bucket whose thread is `streamingThreadIdRef.current`. Total diff: 14 insertions, 1 deletion (commit `3d040c7`). See `.planning/phases/067.5-frontend-reconcile-fix/067.5-01-SUMMARY.md` for the surface fixed and full RED→GREEN cycle.
- Root cause: ChatArea.tsx:89-126 useEffect unconditionally called `clearMessages()` on every `thread.id` change. When user switched BACK to a still-streaming thread, the live placeholder was wiped; `loadMessages` early-returned at useMessages.ts:603 due to `isSendingRef=true`; subsequent SSE callbacks no-op'd; bucket stayed empty until F5. Initial D-2-EARLY-WINDOW hypothesis invalidated by RED test passing — corrected to D-3 after tracing `clearMessages` consumers in ChatArea.
- R-1 cross-thread dual-pass + Phase 067.4 Plans 01/02/03 GREEN regression spot-check: vitest evidence stands (R-1 protection + R-4 active-thread + R-5 heartbeat tests all still pass post-fix; user opted to skip the runtime spot-checks at closure since the Branch D-3 fix is structurally additive to clearMessages and doesn't touch the SSE event dispatcher or per-thread bucket write contract).
- STREAM-04-correctness-round3 residual gap closed; v2.5 milestone gate eligible to advance.
- Carry-forward observation (separate from 067.5 scope): Cycle 5 surfaced a backend `BadRequestError` for `claude-haiku-4-5-20251001` `max_tokens=65536 > 64000` cap. Resume path D-063-04 worked cleanly. Worthy of a separate seed; does NOT invalidate 067.5 closure.

### Phase 56.1: Agent Feedback Gaps (Complete 2026-04-29)

- D-01 (OpenAI _announced_tools): tool_preparing emits exactly once per tool index
- D-03 (ElapsedTimer): setInterval(250ms) with cleanup; clean-out on unmount
- D-05 (Structured mode): two-loop pattern populates buffer before emitting tool_preparing

### Phase 56: Agent Real-Time Feedback (Complete 2026-04-29)

- tool_preparing SSE event eliminates silence windows during tool argument streaming
- Elapsed time counter for running tools
- Initial planning event guaranteed to fire

### Phase 57: SSE Realtime Reconnect Fix (Deferred — see 057-DEFERRAL.md)

- Two attempts failed (Phase 057 v2.4, v2.5-dev branch reverted)
- Root cause: backend FastAPI single-worker + sync supabase calls block event loop
- Plus three frontend race conditions documented for v2.5 to address

## Performance Metrics

**Velocity:**

- Total plans completed: ~80 (across v1.0–v2.4)
- Previous milestones: v1.0 (8 phases), v2.0 (9), v2.1 (8), v2.2 (7), v2.3 (11), v2.4 (14 phases, 2 deferred)
- Average duration: ~1 day/phase

**Recent Trend:**

- Last phase fully shipped: Phase 56.1 (2026-04-29)
- Trend: Stable

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 061 | 01 | 4min | 3 | 4 |
| 061 | 02 | 1min | 2 | 2 |
| 061 | 03 | 16min | 3 (2 commits — Tasks 2+3 atomic) | 1 |
| 061 | 04 | 25min | 2 | 2 |
| 061 | 05 | 10min | 4 | 12 (9 created, 3 modified) |
| 062 | 01 | 12min | 2 | 4 (3 created, 1 modified) |
| Phase 062 P02 | 7min | 2 tasks | 5 files |
| 063.1 | 01 | 13min | 3 | 3 (1 created, 2 modified) |
| 063.1 | 02 | 12min | 2 (3 commits — RED + 2 GREEN) | 3 (modified) |
| Phase 063.1 P03 | 18min | 2 tasks | 2 files |
| Phase 063.1 P04 | 4min | 1 tasks | 1 files |
| Phase 063.1 P05 | ~70min total (across 2 sessions: spec authoring + close-out) | 3 tasks (2 e2e batches + UAT scoreboard fill) | 5 files (3 e2e specs + HUMAN-UAT.md + SUMMARY) |
| Phase 071 P02 | 92min | 4 tasks | 12 files |
| Phase 071 P03 | ~45min | 4 tasks | 7 files (4 created, 3 modified) |
| Phase 071 P04 (Tasks 1-4 of 6) | ~50min | 4 tasks (Tasks 5+6 pending UAT) | 6 files (2 created, 3 modified, 1 deferred-items log) |

## Accumulated Context

### Roadmap Evolution

- v2.5 milestone scoped 2026-05-01 to fix Phase 057 deferral via 5 phases (058–062)
- Research synthesized at .planning/research/058-sse-concurrency-research.md before milestone start
- ROADMAP.md authored 2026-05-01: 5 phases, 5/5 v1 requirements mapped, dependencies form valid DAG (058→059→060→061; 062 parallel-able with 058)
- Phase 063 added 2026-05-02: Skills Test Infrastructure Repair — close TEST-DEBT discovered during 059-02 verification (13+ broken patches in test_threads_skills.py + 3 broken export tests). Standalone, parallel-able with 060-062. Prep for upcoming Skill Studio milestone (see SEED-002).
- Phase 067 added 2026-05-07: Frontend Streaming-UX Fix — close the 5-issue carry-forward dossier (UX-067-01..05) surfaced by Phase 066's live UAT (empty first-paint, "Saving response…" thrash, refresh-required first-paint, redis log noise on tab cycle, tool-call iteration boundary surfacing). Re-runs Phase 066 Plan 05 Task 2 protocol to close out SC#6 live verification deferred from 066.
- v2.6 ROADMAP.md authored 2026-05-12: 15 phases (068–082) across 4 waves derived directly from PRD §12 outline. All 21 v2.6 REQ-IDs mapped; TOKEN-COL-01 (added at signoff post-§12) attached to Phase 073 (asyncpg finalize path) per FLAG F-1. Phases 068/069/070 form Wave 0 (foundational, no inter-wave dependencies); 071-075 form Wave 1 (parallel RAG + asyncpg + polish); 076-078 form Wave 2; 079-081 form Wave 3 (release-gating); 082 forms Wave 4 (cross-cutting verify). Headline path: 069→070→071→076 (Docling) + 073→077→078→079 (multi-worker) + 068 (Streams Provider parallel) → 082 (verify). Phased rollout per Q-v2.6-02 recommendation (NOT atomic like v2.5 D-v2.5-11).
- Phase 071.1 inserted after Phase 071 on 2026-05-15: Docling SC#1 retry — threadpool, timeouts, PyMuPDF fallback (URGENT). Carry-forward from Phase 071 close-out (commit 270eaca): SC#1 live 20%-delta binding gate RED on user thesis pair due to Docling table/layout stall on pages 26-31. Scope per 071-VERIFICATION.md Finding 3: full run_in_threadpool wrap of remaining sync supabase-py calls in /reextract, per-call document_timeout enforcement, do_table_structure / images_scale env knobs, PyMuPDF subprocess fallback wired into the route, friendly-fixture validation, then SC#1 retry on thesis pair.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Recent decisions affecting v2.5 work:

- **D-v2.5-01**: Backend SSE concurrency fix uses `run_in_threadpool` wrapping (tactical) over `asyncio.to_thread` or full async client. Reason: purpose-built for FastAPI/Starlette, respects contextvars, smallest diff. Long-term migration to asyncpg deferred.
- **D-v2.5-02**: Multi-worker uvicorn (`--workers N`) is NOT the answer for the concurrency bug. Masks the issue, breaks in-memory state, hides from observability. Single worker maintained until blocking calls are fixed.
- **D-v2.5-03**: Supabase Realtime treated as best-effort hint, not source of truth. Reconcile via fetch on every (re)connect. Confirmed by Supabase discussion #21093.
- **D-v2.5-04**: SSE architecture refactor uses `asyncio.Queue` + background task + `sse-starlette` (not Celery, not BackgroundTasks). Decouples handler lifetime from agent loop lifetime.
- **D-v2.5-05**: Frontend reconnect uses `visibilitychange` + `pageshow` + single reconcile fetch + Resume button (not auto-polling loop). Don't auto-retry LLM calls — costs money, may duplicate.
- **D-v2.5-06**: Race-condition fix uses `AbortController` cancellation, not request-id refs alone. Confirmed canonical by React docs and Max Rozen post.
- **D-v2.5-07**: Validation harness (Phase 062) lands before Phase 061 reconnect work — addresses the v2.5-dev failure mode where iterating on a complex hook without browser feedback loop hid real bugs.
- Phase 059 plan 03: rename inner sandbox queue to sandbox_queue (Rule 1 fix to plan 02 — UnboundLocalError shadowing bug)
- Phase 059 plan 03: D-059-06 merge gate green; D-059-07 058 regression test still passes; D-059-08 059-VERIFICATION.md published mirroring 058 format
- Phase 059 plan 03: httpx ASGITransport buffers entire SSE response — real mid-stream disconnect cannot be tested via this transport, manual verification (059-VERIFICATION.md) is the runbook for that
- Phase 061 plan 03: Tasks 2+3 committed atomically — wrapping the agent_runner body in `async with asyncio.timeout(...)` requires re-indenting ~1100 lines, which inevitably touches the inner finally Task 3 was scoped to rewrite. Splitting into two commits would have left the file syntactically valid but semantically broken (timeout context with old asyncio.Queue sentinel). Single atomic commit (22a814c) with comprehensive message documents both task scopes.
- Phase 061 plan 03: `_persist_assistant_message` modified to return `Optional[str]` (the inserted message_id) — used by the shielded finalizer to populate `runs.message_id` in the UPDATE. Idempotent re-call returns the cached id from a closure-captured `_persisted_msg_id` slot.
- Phase 061 plan 03: token-counter accounting deferred (RESEARCH Q1 NULL fallback adopted) — runs UPDATE leaves input_tokens/output_tokens NULL; SDK usage capture scoped out of 061. Schema columns exist; future plan can populate without breaking 061's contract.
- Phase 061 plan 03: D-061-03 contract inversion confirmed in code — event_consumer's finally is `pass` (no task.cancel, no await task). Producer survives consumer disconnect; bounded only by asyncio.timeout(120s) per D-061-01.
- Phase 061 plan 05: 8 test files landed for VALIDATION.md TBD-01..11 — 3 unit (test_061_emit_helper, test_061_consumer, test_health), 4 integration (test_061_producer_survives_disconnect with inline cross-tab D-061-15 assertion, test_061_ttl, test_061_runs_table with DDL-inspection RLS variant, test_061_hard_timeout), 1 rewritten integration (test_059_disconnect for D-061-16 contract inversion). Plus shared _run_helpers.py and _build_mock_supabase 'runs' branch. Static gates green; runtime execution deferred to /gsd:verify-work (sandbox blocks venv/Scripts/python).
- Phase 061 plan 05: D-061-16 rewrite of test_059_disconnect.py committed atomically with explicit D-v2.5-08 + Phase 061 references in both file docstring and commit message body — protects future reviewers from misreading the inversion as a regression. Original `test_agent_task_cancels_on_disconnect` removed; new `test_agent_task_SURVIVES_on_disconnect` asserts XLEN growth post-disconnect.
- Phase 061 plan 05: VALIDATION.md frontmatter (`nyquist_compliant: true`, `wave_0_complete: true`) NOT toggled by this commit — those flags require runtime green which the verifier owns. The 11 binding pytest commands are documented in 061-VERIFICATION.md as a single copy-paste block.
- Phase 062 plan 01: anti-false-RED guards on ownership tests — assert detail='Thread not found' AND threads SELECT was actually called; without these the tests pass even before the route is registered
- Phase 062 plan 02: replay_tail_consumer mirrors event_consumer verbatim with last_id=since (D-062-07); zero-line modification of off-limits regions in threads.py confirmed via git diff
- Phase 062 plan 02: top-level 'from redis.exceptions import RedisError' import to avoid the variable-shadowing trap on the route's 'redis' parameter (any 'redis.exceptions.X' inside the handler would AttributeError on the Redis instance); pattern documented in module docstring + inline comment + invariant noted for future maintainers
- Phase 062 plan 02 deviation (Rule 3): added per-file '_reset_redis_singleton' autouse fixture to 3 new stream test files — singleton _redis is event-loop-bound, pytest-asyncio creates per-test loops, so subsequent tests hit a closed loop on the cached singleton (Pitfall 6 mirror); per-file scope avoids surprising 058/059/061 tests
- Phase 063.1 plan 02: onCursor fires AFTER the type-specific dispatch and is SKIPPED on terminal branches (stream_end/error/cancelled return early) — cursor advancement is meaningless once the run has ended; lastEventId resets to undefined after each fire so cursor-less legacy frames don't inherit stale ids
- Phase 063.1 plan 02: reused messagesRef.current (already declared at useMessages.ts:316-319 for stopStreaming WR-03 fix) for the runId-match dedup; same pattern, same justification, no second ref needed
- Phase 063.1 plan 02 (Rule 3 deferred-item): vitest cannot run locally on this machine due to missing rolldown native binding cascade (npm optional-dep bug — @rolldown/binding-win32-x64-msvc + @jridgewell/sourcemap-codec not installed); tests committed and gated via TypeScript compilation per the plan's `<verify>` block; runtime test execution deferred to CI / freshly `npm install`-ed environment
- Phase 063.1 plan 03: inline guardedSetMessages in sendMessage rather than lifting WR-05 to a hook-level helper — reconcile's guard captures activeThreadIdRef !== threadId-snapshot while sendMessage's guard captures streamingThreadIdRef !== activeThreadIdRef; semantically different signatures, so a unified helper would just add indirection
- Phase 063.1 plan 03: dropped abortStream from ChatArea destructure since the only call site is the one being removed (D-063.1-07); abortStream stays exported from useMessages and consumed by genuine-timeout paths (loadMessages's loadAbortRef)
- Phase 063.1 plan 03: D-063.1-10 audit confirmed single useMessages consumer (ChatArea.tsx:39) and stable mount lifetime (no key=thread.id on ChatArea); hook unmount effect only fires on logout/route change — documented in a comment block above the unmount effect
- Phase 063.1 plan 03 (Rule 1 verify-command bug): plan's grep -rn 'useMessages()' src | wc -l == 1 check is too broad — matches the function declaration too; semantically the audit (single consumer in ChatArea) passes via grep -v 'export function useMessages' precision filter
- Phase 063.1 plan 03 (Rule 3 deferred-item carried forward from Plan 02): vitest runtime unavailable on this machine (npm optional-dep cascade); TDD ceremony simplified to TypeScript-gated single commit with behavior cases documented in commit body — matches plan's actual <verify> gate (tsc + grep)
- Phase 063.1 plan 04: reconcileInFlightRef as bool not Map (D-063.1-11) — only one viewing thread at a time, single in-flight bit suffices; mirrors resumeInFlightRef shape verbatim. Sync set BEFORE Promise.all dispatch ensures the second concurrent caller (also synchronous to same tick before its own await) reads true and bails at top guard. Outer try/finally wraps entire body; every early-return path flows through finally to release the lock (T-063.1-13 mitigation).
- Phase 063.1 plan 04: loadMessages MERGE three-clause filter (D-063.1-12) — m.id.startsWith('temp-') && m.runId && !dbRunIds.has(m.runId). Each clause necessary: temp- prefix scopes to placeholders only, runId presence rejects pre-run-backed legacy temps, !dbRunIds.has guards against dup-bubble when DB has caught up (reconcile's runId-dedup at D-063.1-04 will route SSE deltas to the DB row). Spread order [...data, ...liveTempPlaceholders] — DB rows first (chronological from server), placeholders appended (most recent run_id by definition). React keys stable on id field, no collision risk.
- Phase 063.1 plan 04: reconcile for-loop body kept BYTE-IDENTICAL inside new outer try/finally — only structural wrapping changed. Inner indentation preserved at original level (TypeScript whitespace-insensitive); re-indenting ~150 lines would balloon diff and risk subtle drift in dedup/cursor/onTerminal blocks. Plan acceptance criterion explicitly required byte-identical for-loop content vs Plan 02 result.
- Phase 063.1 plan 04 (Rule 3 deferred-item carried forward from Plans 02/03): vitest runtime unavailable on this machine (npm optional-dep cascade — @rolldown/binding-win32-x64-msvc + @jridgewell/sourcemap-codec missing); TDD ceremony simplified to TypeScript-gated single commit with the six behavior cases (Tests 1-6) documented in commit body — matches plan's actual <verify> gate (tsc + grep). Plan 05 E2E specs (063.1-concurrent-reconcile.spec.ts, 063.1-refresh-no-duplicate-bubble.spec.ts) provide cross-stream regression coverage.
- Phase 063.1 plan 05: HUMAN-UAT.md closed `status: partial` with project-level `approved` — splits the two concerns. Project-level approval reflects that Wave 2/3/4 fixes are live and load-bearing (verified via Chrome MCP — all four markers `lastSeenOffsetRef` / `m.runId === run.run_id` / no `abortStream` in ChatArea / `reconcileInFlightRef` + `temp-` filter served at localhost:5173); UAT-file `partial` reflects three SCs that need an end-to-end manual run depending on Phase 064's `ENABLE_TEST_FIXTURES=1` harness (SC#5 cross-tab Stop, SC#6 Resume live, SC#7 full 063 regression). Mirrors Phase 063's precedent where UAT shipped `partial` with similar carry-forwards.
- Phase 063.1 plan 05: Gap-006 (LLM agent stops mid-iteration on complex tool-calling prompts) escalated to a new follow-on phase **"Adaptive Run Timeouts & Lifecycle States"** rather than patched in 063.1. Root cause: `RUN_HARD_TIMEOUT_SECONDS = 120s` (`backend/app/config.py:251`) wraps the entire agent loop via `asyncio.timeout` (`backend/app/api/threads.py:842`); when the timeout fires it cancels the producer task and the cancellation propagates through every nested await including the LangSmith-wrapped LLM stream iterator (surfaces in trace as `GeneratorExit`). Live `runs` table evidence (12-hour window, 24 runs): 5 of 11 cancellations clustered at 120–152s with `error: null`. Out-of-scope rationale: 063.1's scope is frontend gap closure; the timeout pipeline is untouched by 063.1. User-preferred fix paths: (path 2) per-iteration timeout budget that resets on each tool-call boundary + (path 3) split `cancelled` (user) vs `timed_out` (system) lifecycle states with `runs.error = "timed_out after Ns"` populated. Phase number TBD by orchestrator.
- Phase 071 Plan 02: LegacyExtractor returns explicit extractor_name='pypdf-legacy' (CONTEXT.md Discretion recommendation); Phase 069 goldens refreshed with the new key + null bbox/full_markdown entries.
- Phase 071 Plan 02: Dispatcher uses ImportError-guarded lazy registration for PyMuPDF — lets Wave 2 (Plan 02) ship before Wave 2 sibling (Plan 03 PyMuPDF fence) lands.
- Phase 071 Plan 02: ingest_document signature gained 3 kwargs (engine_override / extracted_doc / extract_duration_ms) — Phase 072 RAG-MM-LIFT-01 inherits TODO comment block above extract_and_store_tables/images call sites.
- Phase 071 Plan 03: PyMuPDF AGPL subprocess fence shipped — `import fitz` lives ONLY in `backend/extractors/pymupdf_isolated.py` (child entrypoint OUTSIDE `backend/app/`); parent wrapper at `backend/app/services/extractors/pymupdf.py` spawns via subprocess.run with `cwd=BACKEND_DIR` (T-071-03-05) + `env={'PATH': ...}` (T-071-03-01 env scrubbing). Runtime invariant test `test_fitz_not_imported_by_parent` asserts `{'fitz','pymupdf','PyMuPDF'} & sys.modules == empty` after importing every parent-side module. Fence is enforced by 4 layers: file-tree separation, code review, runtime test, actual subprocess isolation.
- Phase 071 Plan 03 (Rule 1 deviation): PyMuPDF 1.27's `page.find_tables()` prints `"Consider using the pymupdf_layout package…"` directly to sys.stdout, corrupting the JSON IPC contract. Fix: `_redirect_stdout_to_stderr()` context manager swaps `sys.stdout` to `sys.stderr` around the find_tables call. Python-level swap (not `os.dup2`) because the print goes through the TextIOWrapper buffer.
- Phase 071 Plan 03: ExtractionError class added to `extraction_service.py` (not in the parent wrapper) — surfaces subprocess-timeout / malformed-JSON / non-zero-exit failures. Public discovery location for Plan 04 `/reextract` callers.
- Phase 071 Plan 03: pymupdf>=1.24 pinned WITHOUT upper bound (`pymupdf>=1.24`) — D-070-14 comment block's "re-run binding test on pin change" is the lockdown contract, not version cap. Major-version backward-compat at the API level we use (`fitz.Document`, `page.find_tables`, `page.get_images`) has held historically.
- Phase 071 Plan 03: PyMuPDFExtractor restricts `supports()` to PDF only (D-071 discretion) — DOCX continues to route through Docling/Legacy. Keeps the fence's surface minimal; PyMuPDF DOCX is rarely better than python-docx.
- Phase 071 Plan 03: D-070-14 + D-v2.6-01 lines (Pinned by Phase 070 block + supabase==2.29.0 + httpx>=0.28.0,<0.29.0 + docling>=2.93.0,<3.0.0) byte-identical post-Plan-03 — confirmed via `git diff 97cff11:backend/requirements.txt requirements.txt`. New pymupdf>=1.24 pin inserted between pdfplumber and Pillow; Phase 070 binding gate stays GREEN.

### Pending Todos

| Source | Task | Status |
|--------|------|--------|
| 057 | E/F symptoms still unreliable — third attempt scoped to v2.5 | ⏸ Carried forward |
| Phase 056.1 P01 | 127s | 4 tasks | 1 files |
| Phase 056.1 P03 | 10 | 3 tasks | 1 files |
| Phase 059 P03 | 20min | 2 tasks | 3 files |

### Blockers/Concerns

- UAT verification gaps from v2.3 (phases 038–042) still require live browser testing
- Metadata normalization only covers document_type/language
- 15 backend test failures remain from side-phase 002 (test-suite-remediation)
- Phase 46 human UAT (3 items): CASCADE cleanup, dialog rendering, non-contiguous version promotion

### Known Issues

- **KI-001:** In-flight LLM calls and tool executions continue after SSE disconnect because Python async generators can only receive `GeneratorExit` at `yield` points. The current LLM call or tool execution runs to completion before the generator stops. Iteration stops immediately after, preventing new rounds. See `.planning/KNOWN-ISSUES.md`. *(v2.5 Phase 059 may indirectly address this via the asyncio.Queue refactor — handler exits on disconnect, agent task gets cancelled cleanly.)*

## Deferred Items

Items acknowledged at v2.4 milestone close (2026-04-30) — 19 items:

| Category | Item | Status |
|----------|------|--------|
| uat | Phase 45: 45-HUMAN-UAT.md — 5 pending scenarios | partial |
| uat | Phase 46: 46-HUMAN-UAT.md — 3 pending scenarios | partial |
| uat | Phase 48: 48-HUMAN-UAT.md — 6 pending scenarios | partial |
| verification | Phase 45: 45-VERIFICATION.md — human_needed | human_needed |
| verification | Phase 46: 46-VERIFICATION.md — human_needed | human_needed |
| verification | Phase 48: 48-VERIFICATION.md — human_needed | human_needed |
| quick_task | 12 quick tasks marked missing | missing |
| streaming | Phase 057 SSE Realtime Reconnect Fix | deferred → v2.5 |
| streaming | Phase 055 Streaming Reliability (4/5 plans) | deferred → v2.5 |

## Session Continuity

Last session: --stopped-at
Stopped at: Phase 071.1 context gathered (D-071.1-01..06 locked: threadpool sweep on /reextract only, defense-in-depth Docling timeout, PyMuPDF auto-fallback on timeout only, friendly real fixture)
Next: Orchestrator coordinates Task 5 live UAT with user (Chrome MCP + Supabase Studio against `551f03f9-...` PDF + DOCX siblings). User fills 12 TBD slots in `.planning/phases/071-docling-primary-path/071-VERIFICATION.md` and flips frontmatter `status: pending` → `green` or `red`. Then orchestrator authors `071-SUMMARY.md` (Task 6) — at which point Plan 04 closes and Phase 071 ships.

**Phases OPEN (cross-phase blocked):**

- **Phase 067.2** (streaming-render-and-storage-fixes) — OPEN; strict 12/12 gate not met. Rows 3/4/5 resolved by 067.3 in practice but cannot tick GREEN until Row 6 closes via 067.4. Rows 11/12 deferred to 067.4. Audit trail in `067.2-HUMAN-UAT.md` preserved + new `## Phase 067.3 verdict — 9/12 GREEN (gate not met)` section appended.
- **Phase 067.3** (streaming-render-and-storage-fixes-round-2) — OPEN; 5/5 plans landed but Plan 05 closing UAT showed 9 GREEN / 2 RED / 2 deferred. R-3 root cause unidentified during UAT (max_tokens hypothesis disconfirmed live). Full evidence in `067.3-HUMAN-UAT.md` + `067.3-05-SUMMARY.md`.

**Phase 067.4 scope (next):**

- Primary (gate-blocking): R-3 suggestion-emit fix — `backend/app/services/suggestion_service.py` + `backend/app/api/threads.py:2466-2526` emit path investigation + fix.
- Secondary (carry-forward): OpenRouter kimi-k2.5 + minimax-m2.7 synthetic-timeout regression checks.
- Closing UAT: mirror verdicts back into 067.2-HUMAN-UAT.md, 067.3-HUMAN-UAT.md, AND 067.4-HUMAN-UAT.md — close all three phases together when strict gate met.

**Completed Phase:** 063.1 (frontend-stream-decoupling-gap-closure) — 5/5 plans — closed 2026-05-04 (UAT `partial`, project-level `approved`)

**Carry-forward (non-blocking, pre-067.4):**

- SC#5 cross-tab Stop end-to-end (Phase 064 fixture harness)
- SC#6 Resume button live test under `ENABLE_TEST_FIXTURES=1` (Phase 064)
- SC#7 full Phase 063 SC#1–#6 manual regression (next manual UAT pass)

**Earlier queued phase (Gap-006 escalation):** "Adaptive Run Timeouts & Lifecycle States" — phase number TBD by orchestrator (likely 064 or later; distinct from Phase 064 Validation Harness). Full details in `.planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-HUMAN-UAT.md → ## Gaps → Gap-006`. NOT 067.4 scope.

**Planned Phase:** 071 (docling-primary-path) — 4 plans — 2026-05-14T15:13:10.431Z
