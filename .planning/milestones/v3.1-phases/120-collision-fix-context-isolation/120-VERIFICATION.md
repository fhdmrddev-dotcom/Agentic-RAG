---
phase: 120-collision-fix-context-isolation
verified: 2026-06-22T14:45:00Z
status: verified
score: 4/4 must-haves verified (SC#10 live cross-provider 4-axis UAT PASSED 2026-06-22 — see 120-HUMAN-UAT.md)
overrides_applied: 0
re_verification: false
human_verification_resolved: "2026-06-22 — both items PASSED via Claude-driven live UAT (Chrome MCP + browser-JWT chat endpoint + real Docker sandbox + Supabase :54322). SC#10 4/4 axes green across OpenAI/Anthropic/Google/OpenRouter; live 2-files bug reproduced (workflow leftover excluded, exactly one Deep file emitted). Recorded in 120-HUMAN-UAT.md."
human_verification:
  - test: "SC#10 4-axis live UAT: cross-provider (OpenAI / Anthropic / Google / OpenRouter) x multi-tool x parallel-thread x >=50-message history"
    expected: "On each provider: run a workflow render then a Deep skill execute_code in the same thread — exactly one file is emitted and the Deep history contains no harness-origin rows. Multi-tool: post-workflow Deep turn using search_documents + execute_code emits only the new file. Parallel-thread: Thread A (workflow) streaming while Thread B accepts a new Deep prompt — no cross-thread baseline or origin bleed. Long-message: post-workflow thread with >=50 mixed deep+harness rows — Deep replays only deep+legacy rows and the new skill file emits cleanly. Deep Mode proven byte-identical on the native-7."
    why_human: "Requires live cross-provider streaming, a real Docker sandbox session, the actual Supabase messages table, and end-to-end SSE streaming. Cannot be driven by automated unit tests or grep. Per VALIDATION.md SC#10 contract."
  - test: "Live bug confirmation: re-run thread 99af24d5 (or equivalent reproduction)"
    expected: "The confirmed 2-files bug (prior workflow leftover re-emitting alongside the skill's real output) is gone — only the skill's own output file is emitted."
    why_human: "Requires a live Docker sandbox session with a pre-existing /sandbox/output/ file from a prior workflow run, and end-to-end Deep Mode execution."
---

# Phase 120: Collision Fix + Context Isolation Verification Report

**Phase Goal:** A skill that runs in a thread that previously ran a workflow emits only its own output, and a subsequent Deep turn never replays the workflow's history — the live, root-caused collision (Mechanism A) is closed at the harvest baseline and the history-reconstruction filter.
**Verified:** 2026-06-22
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A skill `execute_code` saving exactly one file in a thread that previously ran a workflow emits exactly that one file — the prior workflow's leftover /sandbox/output/ artifact is never re-emitted (the confirmed 2-files bug is gone). | VERIFIED | `snapshot_output_baseline` SHA-256-hashes every pre-existing file at run start; the existing `if h in previous_files: continue` dedup excludes them. `test_stale_workflow_file_excluded_from_skill_emit` passes (byte sizes 37328/11545 from live evidence anchor). 21/21 automated tests green. |
| 2 | The sandbox-output harvest is run-scoped to its own run's baseline, so any file present before the run starts is excluded from that run's emitted outputs. | VERIFIED | `snapshot_output_baseline` (sandbox_service.py:364) returns `{content_hash: {filename, url:None, size, iteration:-1}}` for every pre-existing file. Lazy once-per-run seed in `_handle_execute_code` (tool_dispatcher.py:882-885) via `run_in_threadpool`, guarded by `ctx._output_baseline_seeded`. `test_snapshot_seeds_existing_files` and `test_harness_phase_keeps_own_output` green. |
| 3 | When Deep chat and a workflow share a thread, a Deep turn's history reconstruction replays only `messages.origin = deep` (i.e. `<> harness`) rows — workflow context never bleeds into a subsequent Deep turn. | VERIFIED (with WR-01 caveat — see below) | `_apply_origin_filter` (agent_loop.py:723) chains `.neq("origin","harness")` for every Deep/Explorer turn (`agent_mode != "harness"`). Migration 076 is live: `origin text NOT NULL DEFAULT 'deep'` + `CHECK (origin IN ('deep','harness'))`. 658 legacy rows backfilled to 'deep' (zero NULL confirmed by integration test). Every HARNESS insert site explicitly tags 'harness': harness_engine.py:451/522 (success/failure persists), :240 (raw SQL positional $4, no f-string), :901 (disposition prompt); phase_types.py:636 (llm_human_input prompt); api/runs.py:577/_origin (workflow-fallback branch). 14 CTX-01 unit tests + 3 live-DB integration tests green. **WR-01 caveat:** the `eq("origin","harness")` branch in `_apply_origin_filter` is structurally dead — `body.agent_mode` is never `"harness"` (MessageCreate declares only `"default"` \| `"explorer"`). The write-side dispatch key is `_active_workflow_run_id` (threads.py:1304) and the harness path calls `run_workflow`, never `run_agent_loop`. The isolation property holds because the Deep `neq` branch always fires. The `eq` branch is defense-in-depth per D-120-06/A1 and the plan explicitly anticipated it. This does NOT block SC#3 — the observable truth (Deep never replays harness rows) is met. |
| 4 | The collision fix holds across providers, multi-tool prompts, parallel threads, and long (>=50-message) histories — Deep Mode stays byte-identical on the native-7 (SC#10). | HUMAN_NEEDED | The automated SC#4 (byte-identical no-op for pure-Deep threads) is verified: `test_deep_pure_thread_filter_is_noop` and `test_origin_not_in_projection` pass. `_reconstruct_history` is unchanged; origin is not in the `.select()` projection. The full SC#10 4-axis live cross-provider axis (cross-provider x multi-tool x parallel-thread x long-message) cannot be verified without live providers, a real Docker sandbox, and end-to-end streaming. See Human Verification Required section. |

**Score:** 3/4 truths verified (SC#1, SC#2, SC#3 verified; SC#4 automated portion verified; SC#10 live axis needs human)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/sandbox_service.py` | `snapshot_output_baseline(session) -> dict[str,dict]` helper | VERIFIED | Exists at line 364; SHA-256 hashes pre-existing files; `iteration:-1` marks pre-run entries; fully try/except-wrapped; returns `{}` on empty/failure; never clears disk. |
| `backend/app/services/tool_dispatcher.py` | Lazy once-per-run baseline seed in `_handle_execute_code` | VERIFIED | `snapshot_output_baseline` imported at line 34; seed call at line 882-885 via `run_in_threadpool`, guarded by `ctx._output_baseline_seeded` sentinel; `_previous_files_in_run.update(_baseline)`. |
| `backend/tests/unit/test_120_collision_regression.py` | 4-test regression suite covering the live 2-files bug | VERIFIED | Exists; 4 tests: `test_stale_workflow_file_excluded_from_skill_emit`, `test_empty_baseline_emits_both_files_pre_fix`, `test_snapshot_seeds_existing_files`, `test_harness_phase_keeps_own_output`. All 4 green. |
| `supabase/migrations/076_messages_origin.sql` | `ADD COLUMN origin text NOT NULL DEFAULT 'deep'` + `CHECK (origin IN ('deep','harness'))` | VERIFIED | File exists; contains `NOT NULL DEFAULT 'deep'`, idempotent (`ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`). Applied to live DB via psycopg2-direct (never db push). |
| `backend/app/db/runs.py` | `insert_assistant_message` gains `origin: str = "deep"` param with `$10` positional bind | VERIFIED | `origin: str = "deep"` at line 157; `$10` in INSERT VALUES at line 179; `origin` as final positional arg at line 191. |
| `backend/app/services/agent_loop.py` | `_apply_origin_filter` helper + asymmetric filter at :1024 history query; origin NOT in `.select()` | VERIFIED | `_apply_origin_filter` at line 723; `neq("origin","harness")` at line 744; `eq("origin","harness")` at line 745; call at line 1059 on `body.agent_mode`; `.select("role, content, tool_calls, reasoning_content")` at line 1055 (no `origin`); both `.eq("thread_id")` and `.eq("user_id")` preserved at lines 1056-1057. |
| `backend/tests/test_120_origin_filter.py` | 4+ CTX-01 unit tests | VERIFIED | Exists; 14 tests per SUMMARY (asymmetric filter per mode, SC#4 byte-identical no-op, harness-site tagging, projection + scope guards). All 14 green. |
| `supabase/full-schema.sql` | Regenerated — contains `origin text DEFAULT 'deep'::text NOT NULL` + `messages_origin_check` | VERIFIED | Lines 615-616 confirmed. Produced by `scripts/regenerate-full-schema.sh` (no --reset), not hand-edited. |
| `backend/tests/integration/test_120_migration.py` | Live-DB integration test: zero NULL origin, CHECK accept/reject, NOT NULL DEFAULT 'deep' | VERIFIED | Exists; 3 tests green on live :54322. Rule 1 fix applied (probe INSERTs supply NOT NULL user_id so CHECK is genuinely exercised, not vacuous). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tool_dispatcher.py:_handle_execute_code` | `snapshot_output_baseline` | `run_in_threadpool` on first harvest of a run | WIRED | Line 883: `_baseline = await run_in_threadpool(snapshot_output_baseline, session)`. Guarded by `ctx._output_baseline_seeded` at line 882. |
| Seeded baseline entry | `harvest_output_files` dedup branch | SHA-256 content-hash key collision (`if h in previous_files: continue`) | WIRED | `snapshot_output_baseline` returns `{content_hash: meta}` matching `harvest_output_files`' `previous_files` shape; seeded hashes naturally excluded by the existing dedup. |
| `harness_engine.py` success/failure persists | `insert_assistant_message(..., origin='harness')` | explicit `origin="harness"` kwarg | WIRED | Lines 451 and 522: `origin="harness"`. |
| `harness_engine.py:225` raw SQL INSERT (ask_user expiry) | `messages` table with `origin='harness'` | positional `$4` bind | WIRED | Lines 227-240: `origin` in column list, `"harness"` as positional arg. No f-string. |
| `harness_engine.py:901` (disposition ask_user prompt) | `messages` table with `origin='harness'` | `.insert({..., "origin": "harness"})` | WIRED | Line 901 confirmed. |
| `phase_types.py:636` (llm_human_input ask_user prompt) | `messages` table with `origin='harness'` | `.insert({..., "origin": "harness"})` | WIRED | Line 636 confirmed. |
| `api/runs.py:577/_origin` (workflow-fallback branch) | `messages` table with `origin='harness'` | `_origin = "harness"` set inside confirmed-workflow branch; `"origin": _origin` in insert dict | WIRED | Lines 527 (`_origin = "deep"`), 577 (`_origin = "harness"`) on workflow-fallback branch; line 596 (`"origin": _origin`). |
| `agent_loop.py:1059` history query | `_apply_origin_filter` + `neq("origin","harness")` for Deep | `body.agent_mode` branch | WIRED (see WR-01 caveat) | Line 1059 calls `_apply_origin_filter(_history_q, body.agent_mode)`. For all reachable `agent_mode` values ("default", "explorer"), the `neq` branch fires. The `eq("harness")` branch is dead code per WR-01 but harmless — harness phases do not call `run_agent_loop`. |
| Migration 076 | Live local DB (:54322) | psycopg2-direct (per CLAUDE.md mandate; never db push) | WIRED | Integration test confirms: zero NULL origin, CHECK accepts 'deep'/'harness', rejects 'other'. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `sandbox_service.py:snapshot_output_baseline` | `baseline` dict | Container I/O — `copy_from_runtime("/sandbox/output")` + `os.walk` + `sha256` | Yes — real file content read from Docker container | FLOWING |
| `tool_dispatcher.py:_handle_execute_code` | `_previous_files_in_run` | Seeded by `snapshot_output_baseline` then accumulated by `harvest_output_files` per cell | Yes — real pre-run hash baseline flows into existing dedup | FLOWING |
| `agent_loop.py:_apply_origin_filter` | `_history_q` | Chains `.neq`/`.eq` on the live Supabase `messages` table query | Yes — migration 076 applied; column exists with real values (658 rows, all 'deep') | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full Phase 120 test set (21 tests: unit COLL-01 x4, unit CTX-01 x14, integration x3) | `cd backend && venv/Scripts/python -m pytest tests/integration/test_120_migration.py tests/unit/test_120_collision_regression.py tests/test_120_origin_filter.py -q` | 21 passed, 1 warning in 1.35s | PASS |
| Shared harvest dedup regression guard | `cd backend && venv/Scripts/python -m pytest tests/unit/test_075_4_dedup_supersedes.py -q` | 6 passed, 1 warning in 0.48s | PASS |

---

### Probe Execution

Step 7c: No probe scripts declared in PLAN.md or SUMMARY.md for this phase. No `scripts/*/tests/probe-*.sh` discovered. Skipped.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COLL-01 | 120-01 | Skill saves one file in a post-workflow thread → emits exactly that one file; harvest is run-scoped | SATISFIED | `snapshot_output_baseline` + lazy seed in `tool_dispatcher.py`; 4/4 regression tests green; live 2-files bug signature (37328/11545 bytes) reproduced and excluded. |
| CTX-01 | 120-02, 120-03 | `messages.origin` column + asymmetric filter so Deep never replays harness rows | SATISFIED | Migration 076 live; all HARNESS insert sites tagged; `_apply_origin_filter` in place; 14 unit + 3 integration tests green. WR-01 caveat: the `eq` harness branch is dead but the isolation property holds. |

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps COLL-01 and CTX-01 exclusively to Phase 120. Both are accounted for. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/services/agent_loop.py:743-745` | 743 | `eq("origin","harness")` branch — dead code; `body.agent_mode` is never `"harness"` in production (`MessageCreate` declares only `"default"` \| `"explorer"`) | WARNING (WR-01) | Isolation property holds today via the always-firing `neq` branch. Dead branch overstates the defense-in-depth guard and will mislead future maintainers if harness ever routes through `run_agent_loop`. Write-side mode key (`_active_workflow_run_id`) and read-side filter key (`body.agent_mode`) are decoupled. No fix needed to proceed, but should align before Phase 121/122. |
| `backend/app/services/tool_dispatcher.py:882-885` | 882 | `ctx._output_baseline_seeded` is a dynamic attribute not declared on `ToolContext` dataclass; read via `getattr(ctx, ..., False)` | WARNING (WR-03) | Guard works today (`ToolContext` is not `frozen`/`slots`). Per-harness-phase re-seed is correct behavior (D-120-03) but the comment says "per-RUN" while harness reality is "per-phase" (fresh `ToolContext` per phase). Misleading for maintainers. Not a blocker. |
| `backend/app/services/sandbox_service.py:399-417` | 399 | `snapshot_output_baseline` duplicates the `harvest_output_files` container-I/O preamble verbatim (IN-02) | INFO | Intentional ("mirrors the harvest idiom verbatim") but creates a dual-maintenance point. Low priority. |
| `backend/tests/unit/test_120_collision_regression.py:117-143` | 117 | `test_empty_baseline_emits_both_files_pre_fix` named as "fails-before-fix guard" but passes both before and after the fix (IN-01) | INFO | Only the `ImportError` on `snapshot_output_baseline` made the module RED pre-fix; this test itself does not flip. Misleading name. Low priority rename. |

No `TBD`, `FIXME`, or `XXX` debt markers found in files modified by this phase.

---

### Human Verification Required

#### 1. SC#10 4-Axis Live Cross-Provider UAT

**Test:** Run the full 4-axis UAT matrix defined in VALIDATION.md:
- (a) Cross-provider: for each of OpenAI, Anthropic, Google, OpenRouter — run a workflow render to completion in a thread, then issue a Deep skill `execute_code` prompt in the same thread. Assert exactly one file emits and the Deep history contains no workflow context.
- (b) Multi-tool: a post-workflow Deep turn using `search_documents` + `execute_code` in one prompt. Assert only the new file emits.
- (c) Parallel-thread: Thread A (workflow) streaming while Thread B accepts a new Deep prompt simultaneously. Assert no cross-thread baseline or origin bleed.
- (d) Long-message: post-workflow thread with >= 50 mixed deep+harness rows; issue a Deep skill turn. Assert Deep replays only deep+legacy rows and the new skill file emits cleanly.

**Expected:** On all 4 providers: exactly one file per skill turn, no harness-origin rows in Deep history, Deep Mode byte-identical (native-7 providers produce the same output as before Phase 120).

**Why human:** Requires live cross-provider streaming (OpenAI/Anthropic/Google/OpenRouter), a real Docker sandbox session with `/sandbox/output/` pre-populated by a prior workflow, the actual Supabase messages table on :54322, and end-to-end SSE streaming. The automated tests mock all these surfaces.

#### 2. Live Bug Confirmation — Thread 99af24d5

**Test:** Re-run the live repro scenario from the original collision evidence (thread `99af24d5`): start with a thread that has a prior workflow's leftover `.docx` in `/sandbox/output/` (e.g. `weekly-status-report.docx`, 37,328 bytes), then run a Deep skill `execute_code` that writes exactly one new file. Confirm the emit contains only the skill's file.

**Expected:** The 2-files bug is gone — only the skill's own output file is emitted. No `weekly-status-report.docx` appears in the response's output files.

**Why human:** Requires the exact live state (pre-existing Docker container file from a prior workflow run) and cannot be constructed in a unit test without a real container.

---

### Gaps Summary

No automated test gaps. All 3 mechanically-verifiable success criteria (SC#1, SC#2, SC#3) are satisfied by codebase evidence and the 21-test automated suite. The only open item is SC#10, the live cross-provider UAT axis — explicitly documented as manual-only in VALIDATION.md and the phase plan.

**WR-01 disposition:** The dead `eq("harness")` branch in `_apply_origin_filter` is a code-quality warning, not a correctness/security defect. The code-review explicitly flagged it (WR-01: WARNING, not BLOCKER). The phase plan anticipated this outcome (A1/D-120-06: "the harness does not reconstruct via `messages` today; this is the one place `agent_mode` is evaluated against the history read"). The isolation property (Deep never replays harness rows) is fully met by the always-firing `neq` branch. A future phase should align the read-side key with the write-side mode signal, but this is not required for Phase 120 acceptance.

**Pre-existing failures:** 3 `TestHarvestOutputFiles` tests in `test_sandbox_service.py` are pre-existing test debt (stale assertions against the Phase 075.4 hash-keyed signature pivot). Confirmed red at the phase base before any Phase 120 changes. Not a Phase 120 regression. Documented in `deferred-items.md`.

---

_Verified: 2026-06-22_
_Verifier: Claude (gsd-verifier)_
