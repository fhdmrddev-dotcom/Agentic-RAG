---
gsd_state_version: 1.0
milestone: v2.6
milestone_name: Milestone Context
status: Ready to discuss
stopped_at: Phase 081.1 context gathered (updated)
last_updated: "2026-05-27T08:46:45.486Z"
last_activity: 2026-05-27
progress:
  total_phases: 35
  completed_phases: 29
  total_plans: 85
  completed_plans: 89
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-12) + .planning/PRDs/v2.6.md (scope brief, locked 2026-05-10, signoff 2026-05-12) + .planning/prd-reset/DECISIONS.md (D-PRD-01..15 locked)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** Phase 081.1 — Settings Architecture Unification

## Current Position

Phase: 081.1
Plan: Not started
Next action: `/gsd:discuss-phase 081.1`
Status: Ready to discuss
Last activity: 2026-05-27

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

### Phase 081: SEED-010 OpenRouter UAT (Complete 2026-05-27)

- 1/1 plans shipped; 4/4 synthetic-timeout UAT runs GREEN on OpenRouter-routed models
- **Kimi-k2.5:** Run 1 (simple chat, iter 2) + Run 2 (tool-calling, iter 4) — clean `timed_out` status, correct error format, frontend timeout UX works, title generated
- **MiniMax-m2.7:** Run 3 (simple chat, iter 1) + Run 4 (tool-calling, iter 0) — clean `timed_out` status, correct error format, frontend timeout UX works, title generated
- **BUG-260526-02:** Kimi thinking text leakage NOT observed on OpenRouter route — bug scoped to direct Moonshot API only
- Closes POLISH-SEED-010-01 and 067.2 Rows 11-12 carry-forward
- .env temporary override applied then restored; no code changes

### Phase 079: D-v2.5-02 Supersession + Multi-Worker Enable (Complete 2026-05-27)

- 2/2 plans shipped; D-v2.5-02 formally superseded by D-PRD-12 ADR; WORKER_COUNT=2 default enabled
- **D-PRD-12 ADR:** singleton audit table (8 entries), scaling triggers (backpressure-based), re-trigger clause (immediate revert for data corruption, diagnostic-first for non-user-visible); authored in DECISIONS.md between D-PRD-11 and D-PRD-13
- **Migration 052:** `runs.spawned_by_worker` nullable TEXT column; `insert_run` writes `os.getpid()` at INSERT time
- **Config flip:** CLAUDE.md single-worker rule replaced with multi-worker D-PRD-12 reference; `.env.example` has `WORKER_COUNT=2`; `restart-backend.ps1` reads WORKER_COUNT with --reload/--workers conditional + 1-16 clamp
- **Live verification:** 2 workers started (PIDs 65248 + 63464), two-tab smoke test passed, spawned_by_worker populated with distinct PIDs on new runs
- Code review: 0 critical / 2 warnings (WR-01 TryParse guard, WR-02 dev-default consideration)
- Requirements closed: WORKER-LIFT-01, WORKER-LIFT-03

### Phase 076.2: Provider Streaming Parity + DeepSeek Full Integration (Complete 2026-05-26)

- 4/4 plans shipped + 2 UAT fixes; SEED-032 Gap 1+2 CLOSED; 4 bugs documented (BUG-260526-01..04)
- **DeepSeek thinking mode:** thinking.type="enabled" + reasoning_effort="high"; reasoning_content round-trip in agent loop (accumulate, reset between iterations, include in in-memory message); reasoning_delta SSE events; MessageResponse reasoning_content field; 9 unit tests
- **Frontend Thinking block:** collapsible reasoning content in RunCard (Radix Collapsible, collapsed by default, monospace font, scrollable); reasoning_delta pipeline through types/api.ts/StreamsProvider
- **Google Skills (BUG-260524-01):** confirmed behavioral — Gemini receives skill tool declarations but doesn't invoke; debug logging added at DEBUG level
- **Kimi UAT fixes:** base URL api.moonshot.cn→api.moonshot.ai (domain changed); sub-agent moonshot-v1-8k→kimi-k2.6 (8K overflow)
- **UAT:** DeepSeek DS-1..5 PASS (deepseek-v4-pro, 282K in), Kimi KI-1..3 PASS (kimi-k2.6, 957K in), MiniMax/GLM deferred (API keys pending)
- **Bugs found:** BUG-260526-01 (tool card duplication during streaming, cosmetic), BUG-260526-02 (Kimi thinking leaks into content, medium), BUG-260526-03 (finalOutputFiles SSE-only, medium), BUG-260526-04 (timer disappears mid-cycle on temp-id remount, minor)
- Code review: 0 blockers, 2 warnings (WR-01 thinking mode allowlist, WR-02 onReasoningDelta optional)

### Phase 076.1: Provider Integration + UX Status Fidelity (Complete 2026-05-26)

- 4/4 plans shipped + 11 post-UAT fixes; UAT 12/13 passed (1 deferred to SEED-032)
- **UX Status Fidelity:** auto-scroll to active tool panel on tool_preparing; "Generating code"/"Executing code" status labels; sticky timer bar (elapsed + step + file count + description); elapsed counter replaces static "queued"; failure reason badges via errorCategories.ts + runError on Message; two-pass text dedup (paragraph + sentence level); Google atomic "Waiting for model..." UX
- **Multi-batch fix (critical):** StreamsProvider dedup guard (Phase 075.2 BUG-260521-01) matched by tool name alone, silently dropping iterations 2+ of same-name tools. Fixed: iteration-aware dedup IDs (`preparing-${iteration}-${index}`) + iteration-scoped finalized guard in onToolStart
- **Provider Integration:** 4 direct providers (DeepSeek api.deepseek.com, Moonshot api.moonshot.cn, MiniMax api.minimax.chat, Zhipu open.bigmodel.cn) registered across _PROVIDER_BASE_URLS, MODEL_CAPABILITIES, _SUB_AGENT_MODEL_DEFAULTS, _INFERENCE_PATTERNS, Settings UI; KNOWN_PROVIDERS derived from _PROVIDER_BASE_URLS (single source of truth); OpenRouter relabeled "experimental"
- **DeepSeek:** thinking mode disabled (extra_body.thinking.type="disabled") pending SEED-032; migration 050 (reasoning_content column) + streaming accumulator + DB persist wired as groundwork; title gen refusal guard; deepseek-v4-flash registered with 200K context / 65K output / 300s timeout
- **Code review:** 4/4 warnings closed (WR-01 fileCount status, WR-02 completedCount status, WR-03 competing scroll effects merged, WR-04 single-source providers)
- Merged scroll effects into single useEffect (tool panel priority over bottom scroll); error badge reads parsed.error ?? parsed.message for non-terminal SSE events
- SEED-031 absorbed; SEED-032 planted (DeepSeek thinking mode + real-time UI parity)

### Phase 076: Confidence Recalibration (Complete 2026-05-25)

- 2/2 plans shipped: Plan 01 created reusable calibration script (scripts/calibrate_confidence.py); Plan 02 ran calibration against live corpus (N=121 queries), applied D-04 ADJUST path, documented in PROJECT.md
- Thresholds adjusted from 0.55/0.40 to 0.54/0.38 — post-071.3 extraction stack (camelot tables + pymupdf_full images + legacy text) shifted chunk score distribution lower (median avg_similarity 0.4861)
- Bucket proportions restored to D-04 targets: 30.6% high / 45.5% medium / 24.0% low (old thresholds produced 14%/54%/32%)
- knowledge_health.py LOW_CONF_THRESHOLD + HIGH_CONF_THRESHOLD aligned per D-07; messages.confidence_* schema unchanged (D-v2.5-12 preserved)
- Telemetry: pdf_extraction_runs.engine schema confirmed; column populates on next extraction
- RAG-RECAL-01 CLOSED, Q-v2.6-03 EXECUTED
- Operator reviewed and approved calibration outcome

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
| Phase 071.2 P02 (Task 1 of 2) | ~4min | 1 task (Task 2 checkpoint:human-verify parked) | 1 file (DocumentStatusBadge.tsx +2/-0) |
| Phase 071.2 P05 (Tasks 1+2-code+3+5 of 5) | ~50min | 4 tasks (Task 2 SQL-apply + Task 4 live UAT parked at checkpoint:human-action) | 17 files (12 created — 6 adapters + 6 tests + 1 integration test + 2 seeds + 1 migration + 1 SUMMARY; 5 modified — extraction_service.py, user_settings.py, documents.py, test_documents.py, test_071_1_threadpool_sweep.py) |
| Phase 072 P02 | ~7min | 2 tasks | 4 files |
| Phase 073 P01 | 5min | 5 tasks | 9 files |
| Phase 073 P02 | 4min | 2 tasks | 3 files |
| Phase 073 P03 | 4min | 4 tasks | 6 files |
| Phase 073 P04 | 6min | 4 tasks | 2 files |
| Phase 075 P01 | 11min | 8 tasks | 6 files |
| Phase 075 P02 | 9min | 7 tasks | 4 files |
| Phase 075 P03 | 13min | 4 tasks | 3 files |
| Phase 075.4 P05 | 22min | 5 tasks | 12 files |
| Phase 075.4 P01 | 20min | 4 tasks | 8 files |
| Phase 075.4 P02 | 30min | 3 tasks | 7 files |
| Phase 075.4 P03 | 40min | 3 tasks | 5 files |
| Phase 075.4 P04 | 16min | 4 tasks | 10 files |
| Phase 075.4 P06 | 70min | 3 tasks | 9 files |
| Phase 075.7 P01 | 75min | 1 tasks | 11 files |
| Phase 075.7 P02 | ~25min | 2 tasks | 3 files |
| Phase 075.7 P03 | ~3h (across continuation agents: T1+T2 initial, T3+T4 continuation #1, T5 continuation #2) | 5 tasks | 11 files (7 created: 1 SUMMARY + 6 Playwright specs; 4 modified: ToolCallPanel.tsx + RunCard.tsx + VALIDATION.md + CLAUDE.md) |
| Phase 076 P01 | 5min | 1 task | 1 file |
| Phase 076 P02 | ~15min (split across executor + checkpoint) | 3 tasks | 4 files |
| Phase 079 P01 | 4min | 2 tasks | 8 files |
| Phase 080 P01 | 7 | 3 tasks | 4 files |

## Accumulated Context

### Roadmap Evolution

- v2.5 milestone scoped 2026-05-01 to fix Phase 057 deferral via 5 phases (058–062)
- Research synthesized at .planning/research/058-sse-concurrency-research.md before milestone start
- ROADMAP.md authored 2026-05-01: 5 phases, 5/5 v1 requirements mapped, dependencies form valid DAG (058→059→060→061; 062 parallel-able with 058)
- Phase 063 added 2026-05-02: Skills Test Infrastructure Repair — close TEST-DEBT discovered during 059-02 verification (13+ broken patches in test_threads_skills.py + 3 broken export tests). Standalone, parallel-able with 060-062. Prep for upcoming Skill Studio milestone (see SEED-002).
- Phase 067 added 2026-05-07: Frontend Streaming-UX Fix — close the 5-issue carry-forward dossier (UX-067-01..05) surfaced by Phase 066's live UAT (empty first-paint, "Saving response…" thrash, refresh-required first-paint, redis log noise on tab cycle, tool-call iteration boundary surfacing). Re-runs Phase 066 Plan 05 Task 2 protocol to close out SC#6 live verification deferred from 066.
- v2.6 ROADMAP.md authored 2026-05-12: 15 phases (068–082) across 4 waves derived directly from PRD §12 outline. All 21 v2.6 REQ-IDs mapped; TOKEN-COL-01 (added at signoff post-§12) attached to Phase 073 (asyncpg finalize path) per FLAG F-1. Phases 068/069/070 form Wave 0 (foundational, no inter-wave dependencies); 071-075 form Wave 1 (parallel RAG + asyncpg + polish); 076-078 form Wave 2; 079-081 form Wave 3 (release-gating); 082 forms Wave 4 (cross-cutting verify). Headline path: 069→070→071→076 (Docling) + 073→077→078→079 (multi-worker) + 068 (Streams Provider parallel) → 082 (verify). Phased rollout per Q-v2.6-02 recommendation (NOT atomic like v2.5 D-v2.5-11).
- Phase 071.1 inserted after Phase 071 on 2026-05-15: Docling SC#1 retry — threadpool, timeouts, PyMuPDF fallback (URGENT). Carry-forward from Phase 071 close-out (commit 270eaca): SC#1 live 20%-delta binding gate RED on user thesis pair due to Docling table/layout stall on pages 26-31. Scope per 071-VERIFICATION.md Finding 3: full run_in_threadpool wrap of remaining sync supabase-py calls in /reextract, per-call document_timeout enforcement, do_table_structure / images_scale env knobs, PyMuPDF subprocess fallback wired into the route, friendly-fixture validation, then SC#1 retry on thesis pair.
- Phase 075.1 inserted after Phase 075 on 2026-05-19: Cross-Provider Streaming Stability + Observability Polish Bundle (URGENT). Carry-forward from Phase 075 cross-provider UAT (`075-CROSS-PROVIDER-UAT.md` v4): 11 bugs catalogued with universal SSE-break confirmed (POLISH-SEED-008-02 live line-by-line code streaming doesn't work in production for any provider — frontend stuck on "Running code" until F5 across OpenAI / Anthropic / OpenRouter). Root cause: `harvest_output_files` at `sandbox_service.py:67-149` runs synchronous blocking I/O on the async event loop (D-v2.5-01 violation), starving SSE keepalive before the terminal frame ships. 4-plan scope locked: Plan 01 universal stream-end recovery (frontend transient-filter widen + `/snapshot.active_runs` reconcile), Plan 02 backend SSE transport stability (`harvest_output_files` → `run_in_threadpool` + pure drain_step helper + post-completion safety-net emit + test skipif fix), Plan 03 Anthropic content-block rendering + sticky bottom indicator, Plan 04 observability + sub-agent transparency + polish (LangSmith Anthropic wrap + per-provider ls_provider/name tagging; sub-agent model logged/payload/tool-card metadata + Settings UI override; system-prompt pip install + /sandbox/output hints; ToolCallPanel dedup; output-files delta view; code_stdout vs code_stderr styling; snapshot 503 short-circuit; delete stale loadMessages on ChatArea mount). Plan 02 ships first (backend root cause); Plans 01 + 03 parallel after; Plan 04 last.
- Phase 075.3 inserted after Phase 075.2 on 2026-05-22: Defensive Chunk Handler + Google Token Accounting (URGENT). Origin: quick-task `260522-gdg-google-15-iter-loop-diagnostic` shipped Path A hotfix `ee3b1f9` (gate `stream_options.include_usage` off for Google) after diagnosing that Phase 073-03's globally-enabled `stream_options.include_usage` collided with Google's OpenAI-compat layer (which puts `usage` on **every** streaming chunk alongside content), causing the chunk handler at `threads.py:1806-1816` to early-return and discard all 5 Gemini models' content. 075.3 converts Path A into defensive Path B: drop the `chunk.usage`-triggered early-return, add provider-aware accumulator (overwrite-last-wins for Google vs `+=` for OpenAI/OpenRouter), revert the Path A gate, restore non-NULL `runs.input_tokens` / `runs.output_tokens` on Google runs. Chrome MCP UAT across all 5 Gemini models. 1 plan. BUG-260522-01 (misleading "after 15 iterations" message) routed to Phase 082.5; SEED-028 native Google SDK split deferred to v3.1.
- Phase 075.7 inserted after Phase 075.6 on 2026-05-24: Live-Execution UX Refactor (Run-Card + Tool-Call Panel) (REFACTOR — closes G-1 + G-5 guardrails). Sketch session 2026-05-24 (commits `10ce3a3` / `f18df4c` / `7fbe609` / `2ea3d7e`) packaged validated visual decisions into `Skill("sketch-findings-agentic-rag")`; this phase consumes them. Three locked decisions: (a) bracketed Run-Card per assistant turn (sticky header + timer/counter + fold-to-summary), (b) Editor-Inset tool-call panel with per-tool inner-body components, (c) Focus Mode composition under long-run stress. Depends on Phase 075.6 (`code_so_far` SSE field). UAT covers mandatory 4-axis bandwidth per CLAUDE.md SC#10. SDK side-effect: `gsd-sdk query phase.insert 75.6 ...` calculated sub-decimal `75.6.1` instead of sibling `75.7`; manually corrected to 075.7 (ROADMAP entry + dir name + Wave-N bullet at top of v2.6 list).
- Phase 076.1 inserted after Phase 076 on 2026-05-25: Provider Integration + UX Status Fidelity. Two-scope phase absorbing ALL findings from 3-hour cross-provider monitoring session (6 providers, `.planning/reports/SESSION-20260525-*.md`) + competitive UX research (Claude.ai/ChatGPT/Gemini/Kimi). **UX scope:** streaming code preview already works (`argsCodeText` + Shiki inset at ToolCallPanel.tsx:717-719) but hidden above viewport — fix direction is auto-scroll to active tool, differentiate generating/executing states, surface failure reasons, dedup repeated narration, sticky timer. NO new SSE events (reverted commit `0dce56a` lesson). **Provider scope:** 4 direct OpenAI-compatible integrations (DeepSeek/Kimi/MiniMax/GLM) reusing `openai_service.py` with per-provider base URLs + API keys + sub-agent defaults + timeout profiles; OpenRouter kept as fallback. Absorbs SEED-031.

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
- Phase 071.2 Plan 04: D-071.2-08 closure — `multimodal_service.extract_and_store_tables/_images` widened with optional `extracted_doc: "ExtractedDocument | None" = None` kwarg. Precedence: when `extracted_doc.tables/.images` is non-empty, use it (bbox flows into migration 042 columns); else fall back to legacy pdfplumber/python-docx pass (backward-compat preserved via default kwarg). Conditional bbox spread `**({"bbox": t["bbox"]} if t.get("bbox") is not None else {})` keeps DB writes clean.
- Phase 071.2 Plan 04: D-071.2-10 closure — `/reextract` owner SELECT wrapped in try/except. supabase-py's `.maybe_single().execute()` raises on `is_latest=False` filter (prior failed cascade) rather than returning `.data=None`; now caught and re-raised as `HTTPException(404, "Document not found")`. Bare `raise` (no `from e`) per T-071.2-04-01 — avoids leaking PostgrestAPIError internals.
- Phase 071.2 Plan 04: D-071.2-11 preservation — the two `ingestion_step` UPDATE writes at documents.py:1158 (`extracting_tables`) and :1169 (`extracting_images`) are byte-identical post-edit. They feed Plan 02's badge labels. Only the 7-line `TODO Phase 072 (RAG-MM-LIFT-01/02)` comment blocks above each call were deleted — the UPDATE statements themselves untouched.
- Phase 071.2 Plan 04: TYPE_CHECKING import for `ExtractedDocument` reused the existing `TYPE_CHECKING` block at top of multimodal_service.py (no new guard introduced). Stringified forward-ref annotation `"ExtractedDocument | None"` — zero runtime import cost.
- Phase 071.2 Plan 04 (deferred — orchestrator): Task 3 `checkpoint:human-verify` parked. Requires live uvicorn + thesis-PDF `/reextract` + SQL UAT polling against `documents.status` drain + SC#5 parity (`pdf_extraction_runs.table_count == COUNT(document_tables)`) + SC#5 bbox flow (`jsonb_typeof(bbox) = 'object'`) + SC#6 curl test (`/reextract` on is_latest=false → 404 not 500). Pytest verification denied by sandbox in this executor; live tests remain for post-merge.
- Phase 071.2 Plan 02: D-071.2-11 closure (label side) — `DocumentStatusBadge.tsx::ingestionStepLabel` widened from 4 to 6 cases. Added `if (step === "extracting_tables") return "Extracting tables"` and `if (step === "extracting_images") return "Extracting images"` AFTER the existing `extracting` case and BEFORE the `chunking` case (matches backend ingestion_step write order: extract → tables → images → chunk → embed → metadata). Diff: 2 inserted / 0 removed. TypeScript clean. `useDocuments.ts` Realtime wiring untouched per plan verify-only directive.
- Phase 071.2 Plan 02 (deferred — orchestrator): Task 2 `checkpoint:human-verify` parked. Sequential executor lacks `mcp__chrome-devtools__*` tools in this session AND Bash sandbox denies network probes (curl / Invoke-WebRequest), so neither automation nor manual dev-stack probing reachable. Plan anticipates this fallback path. Orchestrator drives the live UAT against http://localhost:5173/ with test login fhdmrd@gmail.com / 123456: SC#1 (/upload 201 latency <1.5s) + SC#2 (concurrent /health <2s under in-flight extract) + SC#3 (Realtime-driven `pending → processing (Extracting → Extracting tables → Extracting images → Chunking → Embedding → Extracting metadata) → completed` cycle without manual refresh, both new labels rendering during the tables/images phase). Records results in `.planning/phases/071.2-ingestion-plumbing-docling-quality-diagnostics/071.2-HUMAN-UAT.md` (file to be created).
- Phase 071.2 Plan 05: D-071.2-01..04 architectural closure — per-aspect dispatcher exists at `backend/app/services/extractors/aspects/`. Composer `extract_composable(raw, mime, engines=None)` in extraction_service.py routes each aspect through its independent registry. Defaults from migration 045 strict-wins (legacy text, docling_tf tables, pymupdf_full PDF images, zip_xpath DOCX images, docling_formula equations). Per-call hint `?engines=text:docling,tables:docling_tf,...` plumbed on /upload + /reextract; admin-disable via `app_settings.extraction_per_call_hints_enabled`.
- Phase 071.2 Plan 05: zip_xpath_docx is verbatim port of Docling MsWordDocumentBackend XPath algorithm (lines 58-69 namespaces, 78-83 XPaths, 2122-2127 + 2181-2186 rel-ID dereference). Walks word/document.xml + word/header*.xml + word/footer*.xml. Dedups by media path. Hardened parser per T-071.2-05-03 (resolve_entities=False, no_network=True). Closes RAG-MM-LIFT-02 at unit level via programmatic anchor-only DOCX fixture (zipfile + raw XML strings — no binary checked in).
- Phase 071.2 Plan 05: Equations attribute verification (PATTERNS.md MEDIUM-confidence flag) resolved clean — DoclingDocument.texts (docling_core/types/doc/document.py:2638) contains FormulaItem (line 1897) with `label == DocItemLabel.FORMULA`. Adapter walks `doc.texts` filtering by label. No fallback path active.
- Phase 071.2 Plan 05: get_extractor backward-compat shim PRESERVED untouched. Plan 04 + 071.1 + Phase 069 tests stay green on the happy path; PyMuPDF fallback path in /reextract still uses get_extractor (composer raises asyncio.TimeoutError → route catches → get_extractor('pymupdf') fallback).
- Phase 071.2 Plan 05: /reextract body.engine becomes TEXT engine alias when ?engines= absent — `engines_dict = {"text": body.engine}`. Preserves 071.1 API for all existing UAT scripts. Integration tests updated to patch extract_composable on happy path + get_extractor only on fallback path.
- Phase 071.2 Plan 05 (deferred — orchestrator): Task 2 migration apply + Task 4 live UAT parked TOGETHER at `checkpoint:human-action` — CLAUDE.md prohibits `supabase db push` / `db reset` so executor cannot apply migration 045 directly. Orchestrator: (a) paste `supabase/migrations/045_app_settings_extraction_aspects.sql` into Supabase Studio SQL editor (http://127.0.0.1:54323/ → SQL Editor → Run), (b) `bash scripts/regenerate-full-schema.sh` (live-DB dump, no reset), (c) commit regenerated `supabase/full-schema.sql`, (d) restart uvicorn (Docling singleton cache), (e) drive Task 4 UAT (D-071.2-12 floor curl + SQL on thesis PDF/DOCX, RAG-MM-LIFT-02 closure, per-call hint smoke tests). Pytest verification by orchestrator: `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_extract_composable.py tests/unit/test_aspect_engines_*.py tests/unit/test_extraction_service.py tests/unit/test_multimodal_extraction.py tests/unit/test_071_1_threadpool_sweep.py tests/integration/test_documents.py tests/integration/test_extraction_dispatcher.py -x -q`.
- Phase 072 Plan 02: ImageData frozen-dataclass mutation uses dataclasses.replace exclusively — no attribute-set, no try/except, no isinstance branching (D-072-06)
- Phase 072 Plan 02: _dedup_images_by_hash is a module-scope helper composable by independent engines via lazy import — applied to pymupdf_full_images_pdf + zip_xpath_docx + inline_shapes_docx (WARNING 5 — safe across both extraction_image_engine_docx defaults)
- Phase 072 Plan 02 deviation (Rule 1): test_pymupdf_full_returns_more_than_pdfplumber Rule-1 fix — switched fake_doc.extract_image.return_value (singleton, identical bytes collapse 5→1 under new SHA1 dedup) to .side_effect with 5 distinct PIL-generated PNG payloads
- Phase 073 Plan 01: JSONB codec registers via init=_init_pg_connection callback at asyncpg.create_pool time, NOT pool.set_type_codec (which doesn't exist on asyncpg.Pool — Pitfall 5). Codec calls conn.set_type_codec('jsonb', encoder=json.dumps, decoder=json.loads, schema='pg_catalog') per Connection at pool init.
- Phase 073 Plan 01: _reset_pg_pool_singleton autouse fixture promoted suite-wide via tests/conftest.py (D-073-12) — must be @pytest_asyncio.fixture (not @pytest.fixture) so teardown can await pool.close(). Mandatory because asyncpg pools are event-loop-bound and pytest-asyncio creates a fresh loop per test (Pitfall 1).
- Phase 073 Plan 01: FastAPI lifespan close-order is Redis aclose → asyncpg pool.close (with 5s wait_for + pool.terminate fallback) → sandbox close. Phase 078 (CQ-SUPA-01) will add _supabase.aclose() AFTER the pg pool close.
- Phase 073 Plan 02: app.db.runs ships three keyword-only async helpers (insert_run / finalize_run / insert_assistant_message); all SQL uses asyncpg $N positional placeholders (T-073-02 audit grep returns 0); finalize_run accepts int | None tokens (D-073-09); insert_assistant_message returns the UUID via RETURNING id; 8/8 unit tests green against _build_mock_pg_pool()
- Phase 073 Plan 03: stream_options={'include_usage': True} added GLOBALLY to openai_service.py kwargs dict (D-073-08 mandate) — single flip covers BOTH OpenAI direct AND OpenRouter because both route through the same client.chat.completions.create call per config.py:_PROVIDER_BASE_URLS.
- Phase 073 Plan 03: anthropic_service.stream_anthropic yields normalized usage events on message_start ({'type':'usage','input_tokens':N,'output_tokens':M}) and message_delta ({'type':'usage_delta','output_tokens':N}). Pitfall 9 doc'd in code: event.usage.output_tokens on message_delta is FINAL CUMULATIVE for THAT Message, not a per-event delta — consumer adds it once per Message.
- Phase 073 Plan 03: accumulator function shape locked as (chunk_or_event, input_total, output_total) -> (input_total, output_total) — pure tuple return so Plan 04 can inline the body verbatim into threads.py closures with one-line nonlocal tuple-assignment. _MISSING_USAGE_FORMAT = 'runs.usage missing for run=%s provider=%s model=%s' is the canonical warning literal Plan 04 will inline into _shielded_finalize step 3 (T-073-04 negative-assertion gate locks out tokens=/value=/usage_dict/%d).
- Phase 073 Plan 04: All 3 hot-path call sites flipped from aexec to asyncpg helpers (runs INSERT at threads.py:974, messages INSERT at :1310, runs UPDATE finalize at :2651). Spawn-failure runs UPDATE at ~:997 STAYS on aexec per D-073-04 SC-minimum. T-073-03 final scope verified: exactly 3 helper calls in exactly 1 file (threads.py). aexec import preserved for cold-path consumers.
- Phase 073 Plan 04: Run-level token accumulators (input_tokens_total / output_tokens_total) live in send_message's closure adjacent to full_content / persisted_tool_calls; both default to None (D-073-09 NULL sentinel). _on_chunk_openai and _on_chunk_anthropic both extend nonlocal with the two slot names and accumulate per Plan 03's locked handler shapes. _shielded_finalize step 3 emits logger.warning('runs.usage missing for run=%s provider=%s model=%s', ...) BEFORE finalize_run when both slots are None — T-073-04 mitigation locked (format string has identifiers only, 0 token-value leaks per audit grep).
- Phase 073 Plan 04: test_073_concurrency.py (real-Postgres binding gate, 4 tests, 306 lines) ships alongside the preserved test_058_concurrency.py (mock-Supabase gate) per D-073-11 two-gate strategy. test_058 confirmed byte-identical post-Plan-04. test_073 covers singleton-reset autouse contract + JSONB codec round-trip + TOKEN-COL-01 non-NULL persistence + CONCUR-01 under asyncpg. 4/4 green locally against postgres:postgres@127.0.0.1:54322.
- Phase 073 Plan 04 Rule-1 deviation: test_thread_user fixture initially used bare try/except: pass around threads INSERT, but local Supabase has threads.user_id -> auth.users.id FK constraint that mock-Supabase test_058 fixture never exercises. Fix: seed auth.users row first (only id is strictly NOT NULL); FK-safe cleanup order (runs/messages -> threads -> auth.users); pytest.skip on schema mismatch with actual exception surface.
- D-075-13 (BUG-260518-01 fix): inline payload extension on buffer_expired_during_tail with recently_active + runs_status discriminator; consumer-side layering in StreamsProvider routes transient vs terminal
- D-075-14 (BUG-260514-03 fix): sticky bottom-indicator text via stickyLabelRef in MessageItem.tsx; code_stdout subscription IMPLICIT via existing onCodeStdout outputLines mutation that re-renders MessageItem
- Phase 075 Plan 02: session.run() → session.execute_command(python -u code_file, on_stdout, on_stderr); python -u MANDATORY for unbuffered stdout under Docker tty=False exec_run; libraries install hoisted into separate session.install() call
- Plan 03 tool_args_progress SSE primitive shipped — OpenAI emit at threads.py:1737-1782 + Anthropic yield at anthropic_service.py:204-236 + threads.py _on_chunk_anthropic dispatch branch routing the new yield to _emit. Both D-075-11 filters enforced (execute_code skip both paths + STRUCTURED skip OpenAI only). All 6 integration tests GREEN.
- Phase 075.4 Plan 05 (Wave 0): /health endpoint already existed at main.py:140-148 returning {status, redis} — no new health.py created; plan Step 3 fallback satisfied. Verified via TestClient.
- Phase 075.4 Plan 05 (Wave 0): Bug-report frontmatter (7 reports) was already in target state from /gsd:discuss-phase 075.4 sweep — Task 5 verified via grep; no edits required.
- Phase 075.4 Plan 05 (Wave 0): vitest.config.ts gained exclude tests/e2e/** so Playwright scenario-NN-*.spec.ts files don't get picked up by vitest's default glob and crash under jsdom.
- Phase 075.4 Plan 05 (Wave 0): fk_aware_runs_factory uses dual-path supabase resolution (caller fixture preferred -> env fallback -> pytest.skip) so the suite-wide conftest works for both mock-Supabase unit tests and real-Postgres binding tests.
- Phase 075.4 Plan 01: 5 cross-thread globals lifted to per-thread Map/Set in streamsStore.ts (D-075.4-A1); STREAMS_CACHE_VERSION unchanged at 1 (D-075.4-A2 — cache reader walks bucketsBySurface only)
- Phase 075.4 Plan 01: 4 new thread-scoped selectors in StreamsProvider (useStreamingForThread / useLoadingForThread / useReconcileErrorForThread / useFallbackNoticeForThread); useIsStreaming back-compat preserved via streamingThreads.size > 0
- Phase 075.4 Plan 01: 067.5 Branch D-3 guard predicate preserved VERBATIM (tid !== streamingThreadIdRef.current); inside-the-setState change drops isStreaming: false return key (per-thread sendMessage finally owns streamingThreads.delete authoritatively)
- Phase 075.4 Plan 01: BUG-260523-01 closed at ChatArea L:222 — composer disabled prop reads useStreamingForThread(thread?.id) so Thread A streaming no longer disables Thread B's composer; banner predicate at L:319 simplified since per-thread Map naturally scopes
- Phase 075.4 Plan 01: 8 pre-existing test failures (7 streamsProvider + 1 useMessages) DEFERRED to Plan 075.4-06 — verified pre-existing via git stash round-trip on commit 16ba3ea; root cause is Phase 075 D-075-02 reconcile→getSnapshot swap (mockGetActiveRuns no longer wired); logged at 075.4-deferred-items.md D-075.4-01-DEFER-1
- Plan 075.4-02: UnknownProviderError(ValueError) raised at lifespan startup; _PROVIDER_BASE_URLS single source of truth (D-075.4-B1/B2/B3)
- Plan 075.4-02: ModelCapability extended with uses_max_completion_tokens + supports_parallel_tools optional fields; registry-or-inference pattern applied to 6 sites (D-075.4-NN)
- Plan 075.4-02: Gemini-3 thought_signature captured (capture/echo/persist 3-stage wiring) — closes BUG-260523-02 (D-075.4-C1/C2/C3)
- Plan 075.4-03: _shielded_finalize step swap (step 2/3) closes terminal-status race; SSE 'done' now implies DB-committed by construction. Phase 067.4 Rule 3 suggestion ordering invariant preserved (suggestion block runs in agent body before finally).
- Plan 075.4-03: SHA-256 content-hash sandbox output dedup with supersedes detection structurally closes BUG-260523-03 + naturally closes BUG-260522-02 + auto-closes BUG-260521-02 via re_open_trigger. dict[content_hash, meta] shape pivots from set[str] filename dedup.
- Plan 075.4-03: migration 048 widens messages_role_check to allow role='system' for D-075.4-E1 persistence path. Pre-migration the INSERT is fail-silent (try/except + WARNING log); SSE event remains the user-visible signal. Apply via Supabase Studio SQL editor (CLAUDE.md rule).
- Plan 075.4-03: Anthropic LangSmith @traceable re-verified — decorator already wires correctly; only a documentation comment added above @_ls_traceable at anthropic_service.py:143. Test uses skipif gate on LANGSMITH_TRACING because conftest.py:13 sets it to 'false' for default test runs (avoids live API pings).
- Plan 075.4-04 Task 1 narrow-fix: flushSync wrap of setSavingAI/setError/setSubAgentModelError in SettingsPage handleSaveAIModel (closes 2-click bug via D-075.4-F3 protocol); diff 4+/3- well under ≤10-line bound; live Chrome DevTools UAT deferred to Plan 075.4-06 (chrome-devtools MCP not in executor session)
- Plan 075.4-04 Task 2: save_override sentinel allowlist guard with _PROVIDER_KEY_PREFIXES matrix (sk-/sk-ant-/sk-or-) + _SENTINEL_VALUES frozenset; rejected api_key writes log WARNING and skip silently (no HTTP 422 — that escalation is Phase 081.1 territory per D-075.4-F2); 20/20 unit + integration tests GREEN
- Plan 075.4-04 Task 3: React.memo MessageItem + useMemo MarkdownRenderer + ChatArea useCallback delegates (onSendMessage + onResume); 6 memo tests GREEN using vi.hoisted() factory pattern
- Plan 075.4-04 Task 4: lazy(import) RetrievalTrendChart splits ~359 KB recharts off main bundle (verified via vite build — index-DpQeoDpY.js has zero Recharts strings); ExecuteCodeBlock per-line stderr badge; OutputFileCard supersedes prop consumes Plan 03 dedup field
- Plan 075.4-06: FK-violation cluster (6 tests) fixed via AsyncMock-patches on app.api.threads.{insert_run, finalize_run, insert_assistant_message} — not via fk_aware_runs_factory (Rule-1 pragmatic: factory targets real-Postgres binding tests, these files use placeholder SUPABASE_URL). AsyncMock pattern is canonical retrofit for Phase 076/077 cleanup of remaining ~80 bucket-c failures.
- Plan 075.4-06: scenario-06 (BUG-260523-04 iteration-parity) stays RED by design as measurement gate. Root-cause fix deferred per CONTEXT.md to a future focused-fix phase. Inline assertion message documents the intentional fail; no xfail/skip applied — the failing output IS the measurement artifact.
- Plan 075.4-06: pytest baseline drifted 95 (RESEARCH) → 98 (live at commit 56c033a). 3-test drift up due to Plans 075.4-01..05 adding tests. Triage doc carries 98 baseline cleanly; post-fix 92 (98-6) confirmed effective.
- Phase 075.7 Plan 01: per-Body prop shapes preserved verbatim (parsed vs raw result) — registry dispatch uses explicit if/else chain in ToolResultBlock to avoid broader type re-plumbing inside the atomic commit (D-02)
- Phase 075.7 Plan 01: ExecuteCodeBody.summarize priority outputFiles[0].filename then last STDOUT line then 'executed' fallback (UI-SPEC §6.3 + RESEARCH §11 Q3 resolved during this plan)
- Phase 075.7 Plan 01 deviation: comment-only edits in 6 sibling files (useMessages, lib/api, OutputFileCard, ToolArgsLivePanel, MessageItem, types/index) to satisfy R-3 grep gate (grep -rn ExecuteCodeBlock frontend/src returns 0) — zero behavioral change
- Phase 075.7-02 RunCard wrapper shipped (commits 90aa0a5 + 0adc09e). Memoized bordered container for tool-bearing assistant turns; sticky header against Radix Viewport, brand-pulse avatar, 250ms timer, iteration counter, active-glow frame. Mounts via single-hunk MessageItem swap; pure-text turns unchanged (D-09). All 7 regression invariants byte-identical (memo, stickyLabelRef D-12, WorkingBadge above, MarkdownRenderer/Confidence/Citation/Suggestion/Feedback below, finalOutputFiles panel, animate-brandPulse predicate). ZERO new keyframes (R-7). Plan 03 owns auto-collapse + collapsed-row JSX + summarizeToolCall wire-in.
- Phase 075.7-03 Focus Mode + 4-axis UAT shipped (commits 5199412 + ce07a57 + ffc77d5 + db0b6f4 + final docs commit). T1: ToolCallPanel ToolResultBlock renders `<div data-testid="tool-result-summary">→ {summarizeToolCall(tc)}</div>` on collapsed past tools (R-4; UI-SPEC §7.5 styling — ml-8 + border-t border-border/50 + font-mono text-xs text-muted-foreground; literal U+2192 prefix). T2: RunCard auto-collapse useEffect with wasStreamingRef one-shot guard (RESEARCH §4.4); lazy useState initializer covers DB-loaded historical (RESEARCH §5.4); collapsed-row `<button type="button">` JSX with statusGlyph/statusWord helpers matching MessageItem banner copy; handleHeaderClick early-returns when runStatus === 'streaming' (D-08); tabIndex mirrors gate for keyboard parity. R-7 holds (grep @keyframes RunCard.tsx = 0). T3: 6 Playwright specs at frontend/tests/e2e/scenario-{07..12}.spec.ts (CONTEXT correction #4) covering 3 of 4 UAT axes automated; scenario-09 4-sub-test for-loop for cross-provider axis with Anthropic DOM-order preservation gate (RESEARCH §6 protecting BUG-260514-02 re-litigation). T4: long-message manual Chrome MCP UAT auto-approved per AUTO_MODE; surfaced to operator via VALIDATION.md 6-step checklist for /gsd:verify-work 075.7. T5: CLAUDE.md hot-file ledger 4 frontend rows flipped to `satisfied (075.7 — 2026-05-24)` (ToolCallPanel.tsx + MessageItem.tsx [NEW row added per planner brief] + StreamsProvider.tsx + useMessages.ts); 2 backend rows (threads.py + anthropic_service.py) UNCHANGED (out of 075.7 scope). G-1 + G-5 guardrails CLOSED on the chat surface.

- Phase 076 Plan 02: D-04 ADJUST path taken — post-071.3 corpus (camelot + pymupdf_full + legacy) shifted avg_similarity distribution lower (median 0.4861); old 0.55/0.40 produced 14%/54%/32% buckets; new 0.54/0.38 restores ~30%/45%/25% D-04 target. knowledge_health.py aligned per D-07. RAG-RECAL-01 CLOSED.
- D-PRD-12 ADR authored (Phase 079): multi-worker enabled, WORKER_COUNT=2 default, D-v2.5-02 formally superseded
- Both deployment guides updated with Redis (3 options), EnvironmentFile+WORKER_COUNT systemd, asyncpg pool tuning; prescriptive single-worker refs fixed in ARCHITECTURE.md/CONCERNS.md

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
Stopped at: Phase 081.1 context gathered (updated)

### Next session: pending USER actions

`.mcp.json` is now PROJECT-SCOPED — no global Windows env vars needed. The LangSmith MCP reads its credentials from `backend/.env` via `scripts/launch-langsmith-mcp.py` (a small wrapper). Supabase MCP intentionally removed (user prefers Supabase CLI + direct Studio access; the prior Supabase MCP setup attempts failed multiple times locally — no value in re-attempting).

Three actions remain — security cleanup + one-time MCP install:

1. **ROTATE Supabase service role key** (security — the OLD key was committed plaintext in `.mcp.json` before commit `890daf2`. Even though `.mcp.json` no longer references it, the OLD key value still exists in git history and is still valid until rotated):
   - Open Supabase Studio at http://127.0.0.1:54323/ → Project Settings → API
   - Click "Reset service role key"
   - Update the NEW key in `backend/.env` as `SUPABASE_SERVICE_ROLE_KEY` (already the existing var name there)
   - Restart backend uvicorn so the new key takes effect

2. **Install the LangSmith MCP server into the project venv** (one-time):
   ```powershell
   backend\venv\Scripts\pip install langsmith-mcp-server
   ```
   Confirm install: `backend\venv\Scripts\langsmith-mcp-server.exe --help` should print usage. If the package name has changed upstream, set `LANGSMITH_MCP_CMD=<actual-name>` in `backend/.env` and the launcher will use it.

3. **Full Antigravity restart** (closes existing Claude sessions; new ones load the new `.mcp.json` with the LangSmith launcher).
   In the next session, verify success by asking Claude to ToolSearch for `langsmith` — tools should appear and be loadable.

### Why no global env vars

`scripts/launch-langsmith-mcp.py` reads `backend/.env` at MCP startup and injects its values into the spawned MCP server's env. Result: `LANGSMITH_API_KEY` lives only in `backend/.env` (gitignored), only this project's `.mcp.json` references the launcher, and other projects on the same machine see nothing of this configuration. Strictly project-local.

If the launcher fails (package not installed, wrong CLI name, etc.), it prints a clear ERROR line to stderr that the MCP runner surfaces — easy to diagnose without env-var detective work.

### Optional: git history cleanup for the leaked key

The leaked Supabase service key is in `.mcp.json` history (commits before `890daf2`). Even after rotation, scrubbing history is good practice if the repo is ever pushed to a non-private remote:

```bash
git filter-repo --invert-paths --path .mcp.json
```

Skip this if the repo stays private and the key is rotated — rotation alone closes the exploit window.

### State of the v2.6 milestone

- Phase 073 (asyncpg pool integration) **complete 2026-05-17** — see `.planning/phases/073-asyncpg-pool-integration/073-VERIFICATION.md`
- Next phase: **Phase 074** (SEED-009 + SEED-011 polish bundle — `claude-haiku-4-5` max_tokens registry + `test_059` fixture cleanup)
- Phase **081.1** newly inserted (Settings Architecture Unification) — see ROADMAP.md L527; eliminates `settings_override.json` before v3.0 starts; depends on Phase 073; closes SEED-024
- Phase 082 (cross-cutting verify) now depends on 081.1

### Three seeds planted this session

- **SEED-023** (adaptive per-call timeouts + duration telemetry) — addresses MiniMax m2.5:free timeout problem; should ship in v2.6 polish range (Phase 077-079) OR v3.1 admin shell
- **SEED-024** (settings architecture unification) — **status: scheduled**, locked to Phase 081.1
- **SEED-025** (sandbox execution telemetry) — fills the observability gap user identified via the pptx skill code-exec failure that self-corrected but was invisible in `runs` table + LangSmith failed-runs view; primary owner v3.0 Skill Studio, could pre-stage in Phase 077

### Diagnostic utilities added

- `scripts/langsmith_recent_failures.py` — reusable Python script that queries LangSmith API for failed/timed_out runs in the last 24h. Reads `LANGSMITH_API_KEY` + `LANGSMITH_PROJECT` from `backend/.env` via python-dotenv (key never echoed). Run from project root: `backend/venv/Scripts/python.exe scripts/langsmith_recent_failures.py`. Used 2026-05-17 to triage 3 recent failures (1 context overflow, 1 OpenRouter peer disconnect, 1 Anthropic credit balance).

### Failure patterns observed during testing (informs SEED-023/024/025)

| Pattern | Example | Where it's fixed |
|---|---|---|
| OpenRouter free-tier peer disconnect mid-stream | `minimax/minimax-m2.5:free` `RemoteProtocolError` 2026-05-17 18:38 UTC | SEED-023 stall detector |
| Context overflow on smaller-context models | `minimax/minimax-m2.7:exacto` requested 207985 tokens / cap 204800 | SEED-024 per-model max_output_tokens admin override |
| Anthropic billing | `claude-haiku-4-5` HTTP 400 credit-balance | User action (top up at https://console.anthropic.com/settings/billing) |
| Code execution `ValueError` self-corrected via retry | pptx skill `add_chart(XL_CHART_TYPE.PIE, ...)` 2026-05-17 | SEED-025 sandbox execution telemetry |
| Secondary-call model mismatch (title/suggestion/sub-agent uses different model than main agent) | UI shows kimi but LangSmith trace shows gpt-5.4 on title-gen calls | SEED-024 (settings unification eliminates the dual-storage drift) — short-term workaround: set `SUB_AGENT_MODEL=<your-model>` in `backend/.env` |

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

**Planned Phase:** 081 (SEED-010 OpenRouter UAT) — 1 plans — 2026-05-27T05:40:11.095Z
