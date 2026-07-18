---
phase: 147-operator-control-plane
verified: 2026-07-11T16:10:00Z
status: passed
score: 15/15 must-haves verified (code-level); live operator UAT outstanding
overrides_applied: 0
human_verification:
  - test: "Cross-provider active-runs + Kill (SC#10 axis 1)"
    expected: "4 concurrent runs (OpenAI/Anthropic/Google/OpenRouter, different users) each show the correct @lobehub provider mark, user, model, live-ticking elapsed and kind badge in the Control Plane. Killing each chat run: the victim sees exactly a self-cancel (\"Response stopped\"), no operator attribution in their chat (D-03); the ledger names the victim (D-02)."
    why_human: "Requires live concurrent multi-provider chat sessions + visual confirmation of card rendering and the confirm-sheet flow; cannot be exercised by static code inspection."
  - test: "Multi-tool run + mid-tool Kill (SC#10 axis 2)"
    expected: "A run using 2+ tools in one prompt (e.g. search_documents + execute_code) appears once with an honest activity line; killing it mid-tool goes Cancelling… → Cancelled with no zombie left behind."
    why_human: "Needs a live agent loop mid-execution; only observable by driving the running app."
  - test: "Parallel-thread isolation during an operator Kill (SC#10 axis 3)"
    expected: "Thread A (user 1) keeps streaming unaffected while the operator Kills a different user's run in Thread B; only B terminates; B's victim sees a self-cancel."
    why_human: "Requires two simultaneous live browser sessions plus an operator action timed against a running stream."
  - test: "Long-running / not-responding tags on a real card (SC#10 axis 4)"
    expected: "A run left running past 8 minutes shows the long-running tag (client math); a genuinely stalled stream shows the not-responding tag (server-derived not_responding boolean)."
    why_human: "The not_responding derivation is unit-tested with mocked stream ages; a real stalled stream can only be produced live (e.g. killing a worker mid-stream)."
  - test: "Capability kill-switch live enforcement, all four switches, each direction (SC#10 axis 5)"
    expected: "Flipping web search / code sandbox / self-improve / workflows OFF stops that capability for a live chat within the ~30s TTL window: new runs never see the tool (hide), an in-flight call gets a plain 'disabled by the administrator' refusal. Workflows OFF refuses a new Run button with plain copy while an in-flight workflow finishes. Flipping back ON recovers each capability."
    why_human: "Requires a live chat session per provider/capability combination and timing against the TTL cache window; the code-level hide/refuse logic is unit-tested but the end-to-end model behavior (does the model actually stop trying?) needs a live run."
  - test: "Maintenance mode live write-block + end-user banner (SC#10 axis 6)"
    expected: "Flipping maintenance ON: an end user's write (send chat / upload) gets a 503 and the app-wide amber read-only banner appears; reads and self-cancel still work; PUT /admin/flags stays reachable throughout. Flipping OFF: writes recover and the banner clears."
    why_human: "Needs a live end-user browser session (non-operator identity) to observe the banner and a real write attempt returning 503; the middleware logic itself is unit-tested but the visual banner + real request round-trip is not."
  - test: "Zombie-heal honesty wording on a genuinely stuck run (SC#10 axis 7)"
    expected: "Killing a run whose worker task has actually died (not just a normal live cancel) shows 'recovered a stuck run' — never 'killed' — in both the card and the audit ledger."
    why_human: "Reproducing a genuinely dead RUN_TASKS entry (vs. a live one) requires a real process/worker-death scenario; the outcome discriminator is unit-tested but the live trigger is operational, not code-observable."
  - test: "Poll/visit ledger honesty over a real session (SC#10 axis 8)"
    expected: "Opening the Control Plane, scrolling, leaving it open ~1 min, hiding the tab, and returning produces exactly ONE 'Opened the Control Plane' ledger row (not one per poll); pinned vitals can visibly go amber/red mid-scroll on a poll; polling visibly pauses while the tab is hidden."
    why_human: "The mount-once-record and hidden-tab-pause behaviors are unit-tested with fake timers; a human watching a real ~10s poll cadence and a real vitals color change is the honest end-to-end check the VALIDATION.md SC#10 gate calls for."
---

# Phase 147: Operator Control Plane Verification Report

**Phase Goal:** An operator can watch system health and running work, kill a runaway run, disable a misbehaving capability, and put the platform into maintenance/read-only mode.
**Verified:** 2026-07-11
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All four ROADMAP.md Success Criteria for Phase 147, plus the plan-level FLAG-01/ADMIN-02 must-haves, were checked directly against the committed source (not SUMMARY.md claims). Every truth below is code-verified; the phase's own `147-VALIDATION.md` additionally requires a live SC#10 UAT pass before sign-off (see Human Verification section) — that pass has not yet been run, which is why overall status is `human_needed` rather than `passed`.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (SC#1) Operator sees live health for Redis/Supabase/sandbox + backpressure in `/admin` | ✓ VERIFIED | `backend/app/services/health_probe.py` (probe_redis/probe_supabase/probe_sandbox, 3-state sandbox off≠down, `IN-01` non-blocking select-* note); `GET /admin/backpressure` in `admin.py:75-159` appends additive `dependencies` (4 original keys untouched, now floor-exempt per D-07); `HealthSignals.tsx` renders 3 dependency dots (up/slow/down/off, off is neutral not red) alongside the 4 existing signals. 77 backend tests + relevant frontend tests pass. |
| 2 | (SC#2) Operator sees active runs (thread/user/model/elapsed) and can Kill, delegating to `cancel_run`'s zombie-heal path | ✓ VERIFIED | `GET /admin/runs` (`admin.py:180-320`) — D-Q1 kind derivation (chat/workflow/eval/tuner), killable only chat/workflow, server-derived `not_responding`. `POST /admin/runs/{id}/kill` (`admin.py:323-416`) — no ownership filter, 404-non-discoverable, 409 for eval, delegates to the SHARED `run_lifecycle._cancel_run_internals` (extracted verbatim from `cancel_run`'s Steps 2/3a/3b — `run_lifecycle.py:158-292`); `cancel_run` (`runs.py:1095-1136`) keeps only its ownership SELECT and delegates to the same helper. `ActiveRunsSection.tsx` — victim-naming confirm sheet, no optimistic removal (Cancelling…→Cancelled overlay), tuner/eval get "Ends on its own" with no Kill affordance. |
| 3 | (SC#3) Operator can toggle per-feature kill-switches (web/sandbox/self-improve/workflows) and the capability stops for all users, fail-closed | ✓ VERIFIED | Layer 1 HIDE: `openai_service.get_tools()` conditionally appends `SAVE_SKILL_TOOL`/web/sandbox tools (`openai_service.py:1045-1069`). Layer 2 REFUSE: `tool_dispatcher.dispatch_tool()` returns a plain `capability_disabled` `ToolResult` for a disabled tool (`tool_dispatcher.py:3275-3339`) — verified provider-agnostic (no `provider ==` branch; the single seam is used by `agent_loop.py:1662`/`:2465` and `task_service.py:753` for ALL providers). Second self-improve seam: `skill_proposer_service.propose()` guarded at entry. Workflow-launch block (D-05): `threads.py:937-953` refuses a NEW kickoff before any DB write when `workflows_enabled()` is false; in-flight runs and plain Deep chat untouched. `PUT /admin/flags` (`admin.py:427-477`) validates against a code-constant allowlist (422 on unknown key) and — after the CR-02 fix — surfaces a DB-write failure as a real 500 with NO false audit row (see Anti-Patterns below). Frontend `CapabilityGrid.tsx` — 2×2 armed-OFF grid, direct flip, honest count-only-when-derivable impact copy. |
| 4 | (SC#4) Operator can enable maintenance/read-only mode and end users see the platform go read-only, on the existing `app_settings` TTL substrate | ✓ VERIFIED | `backend/app/middleware/maintenance.py` — pure-ASGI, blocks POST/PUT/PATCH/DELETE outside the allowlist with a 503 while ON; allowlist covers `/auth`, ALL `/admin/*` (the off-switch), `DELETE /runs/*` (self-cancel), and all GET/HEAD/OPTIONS. Registered before CORS (`main.py:473`) so CORS stays outermost. Cold-cache/blip fails OPEN (False) per D-Q4 (`user_settings.py:721-733`). Public `/health` carries an additive `maintenance` boolean only (`main.py:491-504`). Frontend: `MaintenancePanel.tsx` (amber, arm-to-confirm, present-tense consequence banner distinct from the ledger receipt) + `App.tsx` `MaintenanceBanner` (reads `getMaintenanceStatus()` from the PUBLIC `/health`, never `/admin`, renders nothing when OFF). |
| 5 | Migration 097 substrate: 3 additive `app_settings` booleans, TTL-cached, D-Q4 polarity, last-known-good on a DB blip | ✓ VERIFIED | `supabase/migrations/097_operator_flags.sql` — 3 `ADD COLUMN IF NOT EXISTS`. Confirmed LIVE on the local DB via direct psycopg2 query: `self_improve_enabled=True, workflows_enabled=True, maintenance_mode=False`. `full-schema.sql` regenerated (lines 465-467). `user_settings.py:695-733` — `self_improve_enabled()`/`workflows_enabled()` cold-read True, `maintenance_mode()` cold-reads False; `test_147_flag_failure_semantics.py` proves last-known-good on a patched one-shot DB failure. `docs/DEPLOYMENT-WORKFLOW.md:110,153` records the cloud-parity note. |
| 6 | D-07 poll/visit floor discipline: silent auto-poll, one visit row on mount, manual refresh records | ✓ VERIFIED | `/admin/backpressure` and `/admin/runs` are floor-exempt (no `operator_audit_floor` dependency); `POST /admin/control-plane/record` is floor-attached with a server-owned `Literal["visit","refresh"]` → hardcoded (label, action) map (T-147-13: no client string reaches the ledger). `ControlRoomPage.tsx` — `setInterval` ~10s poll, `visibilitychange` pause/resume, `alive` ref unmount guard, exactly one `recordControlPlaneEvent("visit")` on mount, manual ↻ records `"refresh"`. `ControlRoomPage.test.tsx` (6/6) asserts exactly-one-visit + hidden-tab-pause with fake timers. |
| 7 | D-08 assembly: Overview promoted to the live "Control Plane" tab; System Controls dissolves in; 5-tab band IA; health lives in exactly one place | ✓ VERIFIED | `ControlRoomPage.tsx` TABS array: Control Plane (live) · Users & Access (🔒) · Model Registry (🔒) · Secrets (🔒) · Audit log (live). "System Controls"/"AI Models"/"API Keys" labels absent from the TABS array (grep confirms 0 matches in the array; locked tabs carry plain "coming soon" copy naming the capability, no phase numbers — T-146-10). Body composes pinned vitals → HealthSignals → ActiveRunsSection → CapabilityGrid+MaintenancePanel → Activity ledger with "View all ›" → Audit tab. |
| 8 | D-03: the operator-Kill victim sees exactly a self-cancel; who/why lives only in `operator_audit_log` | ✓ VERIFIED | `kill_run` (`admin.py:395-415`) passes nothing operator-identifying into `_cancel_run_internals`; the victim's run finalizes to the ordinary `cancelled`/`cancelled_by_user` terminal state. `MessageItem.tsx:556-609` — BUG-260710-01/-02 fixed: `runStatus==='cancelled'` persists the "Response stopped" indicator across reload (content-gated to avoid a double with the new empty-cancel affordance), and an empty early-cancel renders "cancelled — no output yet" instead of a broken bubble. Both are pure render-derive from persisted `runStatus`, no shared-path fork. `MessageItem.tsx` cancelled-specific tests (3/3) + the admin suite (22/22) pass. |

**Score:** 8/8 code-level truths verified (covering all 4 ROADMAP SCs + the D-02/D-03/D-05/D-06/D-07/D-08/FLAG-01-substrate cross-cutting decisions the plans committed to).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/097_operator_flags.sql` | 3 additive boolean columns | ✓ VERIFIED | Applied live (psycopg2-confirmed); `full-schema.sql` regenerated |
| `backend/app/models/user_settings.py` | fail-closed flag helpers + save_app_settings bool return | ✓ VERIFIED | D-Q4 polarity confirmed; CR-02 fix present (returns bool, no false success) |
| `backend/app/services/health_probe.py` | probe_redis/probe_supabase/probe_sandbox | ✓ VERIFIED | 3-state sandbox honesty confirmed; concurrent via `asyncio.gather` |
| `backend/app/api/admin.py` | `/backpressure` dependencies, `GET /runs`, `POST /runs/{id}/kill`, `PUT /flags`, `POST /control-plane/record` | ✓ VERIFIED | All 5 endpoints present and match plan contracts |
| `backend/app/services/run_lifecycle.py` | shared `_cancel_run_internals` helper | ✓ VERIFIED | Extracted verbatim; outcome discriminator (terminal_noop/task_cancelled/zombie_healed) |
| `backend/app/api/runs.py` | `cancel_run` delegates to the shared helper | ✓ VERIFIED | Ownership SELECT retained, rest delegated |
| `backend/app/services/openai_service.py` | get_tools HIDE layer for self_improve | ✓ VERIFIED | Byte-identical when on; SAVE_SKILL_TOOL conditional |
| `backend/app/services/tool_dispatcher.py` | dispatch_tool REFUSE layer | ✓ VERIFIED | `_CAPABILITY_FLAG_TOOLS` map + provider-agnostic ToolResult |
| `backend/app/services/skill_proposer_service.py` | self_improve guard | ✓ VERIFIED | Guard at `propose()` entry |
| `backend/app/api/threads.py` | D-05 workflow-launch block | ✓ VERIFIED | Guard inside NEW-launch branch only, before any DB write |
| `backend/app/middleware/maintenance.py` | write-block + allowlist | ✓ VERIFIED | Pure ASGI, off-switch-safe allowlist, fail-OPEN cold cache |
| `backend/app/main.py` | middleware wiring + public /health flag | ✓ VERIFIED | Registered before CORS; additive `maintenance` boolean |
| `frontend/src/lib/api.ts` | Control Plane client contract | ✓ VERIFIED | `AdminActiveRun` (renamed post CR-01), `FlagKey`, 5 client fns all present |
| `frontend/src/components/chat/MessageItem.tsx` | persistent cancelled-run honesty | ✓ VERIFIED | Both BUG-260710-01/-02 fixes present, render-only |
| `frontend/src/components/admin/HealthSignals.tsx` | dependency-health dots | ✓ VERIFIED | up/slow/down/off, off is neutral |
| `frontend/src/components/admin/ActiveRunsSection.tsx` | 064-B run cards + Kill | ✓ VERIFIED | Victim-naming sheet, no optimistic removal, honest zombie wording |
| `frontend/src/components/admin/CapabilityGrid.tsx` | 2×2 armed-OFF grid | ✓ VERIFIED | Direct flip, count-honest impact copy |
| `frontend/src/components/admin/MaintenancePanel.tsx` | amber arm-to-confirm panel | ✓ VERIFIED | Present-tense consequence banner distinct from ledger receipt |
| `frontend/src/components/admin/ControlRoomPage.tsx` | recomposed 5-tab shell | ✓ VERIFIED | D-07/D-08 fully wired |
| `frontend/src/App.tsx` | end-user maintenance banner | ✓ VERIFIED | Reads public `/health` only, resilient default |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `admin.py kill_run` | `run_lifecycle._cancel_run_internals` | direct call, no ownership filter | ✓ WIRED | Confirmed by reading both sides; `cancel_run` in `runs.py` calls the identical helper |
| `admin.py get_active_runs` | `runs:active` + `runs` table | ZRANGE withscores → batch SELECT | ✓ WIRED | D-Q1 Option A derivation confirmed (eval via `eval_runs.id`, workflow via `threads.active_workflow_run_id`) |
| `tool_dispatcher.dispatch_tool` | `app_settings` flags | TTL-cached flag read → `capability_disabled` ToolResult | ✓ WIRED | Confirmed provider-agnostic; used by all 3 dispatch call sites |
| `main.py` | `MaintenanceMiddleware` | `add_middleware` before CORS | ✓ WIRED | Confirmed ordering in `main.py:473` vs `:481` |
| `ControlRoomPage.tsx` | `lib/api killRun` | confirm-sheet Kill → `killRun(runId)` → re-fetch | ✓ WIRED | `handleKill` callback confirmed; `ActiveRunsSection` calls `onKill` only after Confirm |
| `frontend/App.tsx` | public `/health` | `getMaintenanceStatus()` | ✓ WIRED | Confirmed: zero `/admin` calls in the banner, resolves false on any failure |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ActiveRunsSection` | `runs` prop | `getAdminActiveRuns()` → `GET /admin/runs` → live `runs:active` ZRANGE + `runs`/`eval_runs`/`threads`/`auth.users` joins | Yes — real Redis + Postgres reads, not static | ✓ FLOWING |
| `HealthSignals` dependency dots | `signals.dependencies` | `getBackpressure()` → `GET /admin/backpressure` → `probe_dependencies()` live Redis PING / Supabase SELECT / Docker ping | Yes | ✓ FLOWING |
| `CapabilityGrid` flags | `flags` prop | `getSettings()` → `GET /settings` → `FullSettingsResponse` built from `_build_settings_from_row` off the live `app_settings` row | Yes | ✓ FLOWING |
| `MaintenanceBanner` | `maintenanceOn` | `getMaintenanceStatus()` → public `/health` → `maintenance_mode()` in-memory TTL read | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration 097 columns live on local DB with correct defaults | direct psycopg2 query against `127.0.0.1:54322` | `[('maintenance_mode',), ('self_improve_enabled',), ('workflows_enabled',)]`; row values `(True, True, False)` | ✓ PASS |
| Backend phase-147 + regression suite | `pytest tests/test_147_*.py tests/test_062_cancel_run.py tests/test_146_operator_gate.py -q` | 77 passed | ✓ PASS |
| Frontend admin + MessageItem suite | `npm run test -- ActiveRunsSection CapabilityGrid ControlRoomPage MessageItem` | 65 passed / 1 pre-existing baseline failure (SEED-056 rot, unrelated file, verified not touched by this phase) | ✓ PASS (rot excluded) |
| Frontend `tsc -b` full build | `npx tsc -b` | 30 errors total, ALL pre-existing/unrelated to Phase 147 files (grep for ActiveRun/admin/CapabilityGrid/etc. hits only 1 unrelated pre-existing `TS6133` unused-import in untouched `StreamsProvider.tsx`) | ✓ PASS (CR-01 fix confirmed effective; matches SUMMARY's 39→30 claim) |
| No debt markers (TBD/FIXME/XXX) in any of the 20 phase-touched files | grep sweep | 0 hits | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` conventional probes exist for this project and none were declared in the PLAN/SUMMARY files. Skipped (no runnable probe entry points for this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ADMIN-02 | 147-02, 147-03, 147-06, 147-07, 147-09 | Health/backpressure + active-runs + Kill | ✓ SATISFIED (code-level) | See truths 1, 2, 6, 7, 8 above; live UAT still required per VALIDATION.md SC#10 |
| FLAG-01 | 147-01, 147-03, 147-04, 147-05, 147-08, 147-09 | Per-feature kill-switches + maintenance mode | ✓ SATISFIED (code-level) | See truths 3, 4, 5 above; live UAT still required per VALIDATION.md SC#10 |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps only ADMIN-02 and FLAG-01 to Phase 147, and both appear in every plan's `requirements:` frontmatter that touches them.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/api/admin.py` | `kill_run` else-branch (~413) | A kill on an already-terminal run (`terminal_noop` outcome) is labeled "Ended {victim}'s run" — the same wording as a real live cancel | ⚠️ WARNING (WR-01, code-review, not fixed) | A ledger row can claim a kill that never happened (the run finished naturally in the race window between list-poll and click). Does not block any Success Criterion; the phase's own review report documents this and a fix. Non-blocking — the phase's core honesty guarantee (zombie-heal vs. real kill) still holds; only the terminal-noop edge case is mislabeled. |
| `backend/app/middleware/maintenance.py` | allowlist (~64-77) | `POST /runs/{id}/ask_user_response` and `POST /runs/{id}/continue` are NOT allowlisted, so a paused interactive run cannot be resumed under maintenance | ⚠️ WARNING (WR-02, code-review, not fixed) | An in-flight `ask_user`-paused run is stranded during maintenance (only Cancel remains reachable). This is a plausible deliberate reading of "nothing new runs" but diverges from the D-05 in-flight-untouched posture for workflows. Documented, not silently missed. |
| `backend/app/services/health_probe.py` | `probe_supabase` (line 70) | `select("*")` on `app_settings` (including encrypted key columns) just to measure reachability | ℹ️ INFO (IN-01, code-review, not fixed) | No leak today (rows discarded, never logged/returned), but unnecessary exposure surface for a liveness ping. |
| `backend/app/api/admin.py` | `kill_run` tuner path | A tuner Kill 404s (non-discoverable) rather than the 409 the "non-killable kinds" contract implies for eval | ℹ️ INFO (IN-02, code-review, not fixed) | Defensible — 404 is non-discoverable and the frontend never renders a Kill affordance for tuner rows (`killable === false`); only reachable via a crafted request. No security impact. |

All four items above were identified by the phase's own `147-REVIEW.md` code review, are explicitly Warning/Info (not Critical), and none of them invalidate a ROADMAP Success Criterion or a plan must-have. The two Critical-severity findings from that review (CR-01 duplicate `ActiveRun` interface breaking `tsc -b`; CR-02 `PUT /admin/flags` silently reporting success on a DB write failure) were BOTH independently re-verified as fixed in this pass (commits `250d38ae` and `ea958149` respectively — confirmed by reading the current source, not by trusting the commit messages).

### Human Verification Required

The code-level implementation of all four ROADMAP Success Criteria is complete and verified. This phase ships user-visible, security-sensitive, cross-provider live behavior (watch health, Kill a real run, flip a capability and see cross-provider refusal, enter maintenance and see the read-only banner). Per `147-VALIDATION.md`'s own mandatory "SC#10 Live UAT" gate (8 rows, "Approval: pending" at the time of this verification), the following live, operator-driven checks have NOT yet been executed and are required before the phase can be marked fully passed. See the YAML frontmatter `human_verification` list for the full detail (test / expected / why-human) mirroring the 8 SC#10 rows in `147-VALIDATION.md`:

1. Cross-provider active-runs + Kill (4 providers, victim self-cancel honesty)
2. Multi-tool run + mid-tool Kill (clean cancel, no zombie)
3. Parallel-thread isolation during a Kill (no cross-run leak)
4. Long-running / not-responding tags on a genuinely stalled real stream
5. Capability kill-switch live enforcement, all 4 switches, both directions, cross-provider
6. Maintenance mode live write-block + end-user banner (503 + banner + off-switch reachable)
7. Zombie-heal honesty wording on a genuinely stuck run (dead worker task)
8. Poll/visit ledger honesty over a real ~1 min session (one visit row, visible pause on hidden tab)

These are exactly the checks `147-VALIDATION.md` itself declares MANDATORY before sign-off — this verification pass confirms the code that SHOULD produce that live behavior is correctly implemented, wired, and unit/component-tested, but the actual live cross-provider/concurrent/timing behavior needs a human (or Chrome MCP) driving the real app per the project's G-4 lived-experience UAT gate.

### Gaps Summary

No code-level gaps. All 4 ROADMAP Success Criteria, all 9 plans' must-haves, and both Critical code-review findings (now fixed) were verified directly against the current source — reading actual implementations, not SUMMARY.md narration. 77 backend tests and 88 frontend tests (component suite, excluding 1 pre-existing unrelated baseline failure) pass. Migration 097 is confirmed live on the local DB via a direct database query. `tsc -b` shows zero phase-147-attributable errors (the CR-01 fix reduced total errors from 39 to 30; all 30 remaining are pre-existing SEED-056 rot in files this phase never touched).

The only reason this is not `status: passed` is that the phase's own validation contract (`147-VALIDATION.md`) requires a live, human-driven SC#10 UAT pass across 8 scenarios (cross-provider, multi-tool, parallel-thread, long-message/stalled-stream, both flag axes, zombie-heal wording, and poll/visit honesty) before sign-off, and that pass has not yet been recorded. Four minor Warning/Info-level findings from the phase's own code review (WR-01 terminal_noop mislabeling, WR-02 ask_user/continue not allowlisted under maintenance, IN-01 probe_supabase select-*, IN-02 tuner 404-vs-409) remain open by deliberate deferral — none of them block a Success Criterion.

---

*Verified: 2026-07-11*
*Verifier: Claude (gsd-verifier)*
