---
phase: 096-eval-harness-cross-provider-verification-concurrency
plan: 06
subsystem: testing
tags: [eval, cross-provider, harness, workflow, ask_user, capability-table, psycopg2, scripts]

# Dependency graph
requires:
  - phase: 096-01
    provides: eval_coverage 5-type seed workflow (migration 066, slug-resolvable, published+global) + eval_slow_step programmatic fn
  - phase: 088
    provides: scripts/eval_cross_provider.py plumbing (localhost gate, presence-only env, bearer mint, psycopg2 helpers, EVAL_ROW markers)
  - phase: 092
    provides: workflow kickoff via POST /threads/{id}/messages + workflow_definition_id (threads.py:835) and the thread anchor
  - phase: 085
    provides: POST /runs/{rid}/ask_user_response (+ F10 workflow_run-id fallback, runs.py:521-567)
provides:
  - "--workflow row type: one command drives eval_coverage end-to-end per provider with DB-truth assertions (phase sequence, single-completion audit, tool round-trip, robot-answered ask_user)"
  - "D-02a regression insurance: the ask_user round-trip is robot-watched on every eval run (the panel's own endpoint, no bypass)"
  - "D-04 capability table: versioned JSON+MD twin under .planning/eval/ per full run (measurement only)"
  - "D-01 part-2 operator live-gate ritual documented at the script's front door + .planning/eval/README.md"
affects: [096-07, 096-08, phase-096-verification, v2.9-feature-fit-routing]

# Tech tracking
tech-stack:
  added: []
  patterns: ["allowlisted constant-SQL dict per id-kind (_WORKFLOW_QUERIES extends _COUNT_QUERIES posture)", "jsonb_typeof CASE normalization for double-encoded jsonb consumers", "distinct diagnostic outcomes (terminal_before_answer/missing_api_key/timeout) instead of generic FAIL"]

key-files:
  created: [.planning/eval/README.md]
  modified: [scripts/eval_cross_provider.py]

key-decisions:
  - "model_effective prefers sub-agent runs.model rows (parent_run_id IS NOT NULL) over the plan's all-thread-models query — more faithful to the Pitfall-1 must-have; all-models kept as fallback"
  - "tool round-trip proof = messages tool_calls OR workflow_phases.output grounding (harness sub-agent transcripts are in-memory; the final message persists no tool_calls)"
  - "capability table emits only on FULL --workflow runs (no --provider filter) so partial re-runs never clobber a full table from the same day"
  - "arg_shape_ok = null for workflow rows (sub-agent args never persisted in v2.8) — documented in README, Deep matrix still measures arg shape"
  - "retry_count proxy = gate_failed audit rows with attempt > 1 (documented measurement-only under-count of pass-after-retry)"

patterns-established:
  - "Workflow eval rows: poll workflow_runs.status + pending ask_user TOGETHER each tick (Pitfall 2); answer only while non-terminal"
  - "Double-encoded jsonb consumers: CASE WHEN jsonb_typeof(col)='string' THEN (col #>> '{}')::jsonb ELSE col END handles both shapes"

requirements-completed: [EVAL-01]

# Metrics
duration: 21min
completed: 2026-06-07
---

# Phase 096 Plan 06: Eval Workflow Row Type + Capability Table Summary

**`--workflow` drives the eval_coverage 5-phase-type workflow per native-7 provider with DB-truth assertions and a robot-answered ask_user, emitting the versioned D-04 capability table — proven live end-to-end on openai (PASS, 54.5s, effective model honestly reported as gpt-4o, not the requested column).**

## Performance

- **Duration:** 21 min
- **Started:** 2026-06-07T02:44:03Z
- **Completed:** 2026-06-07T03:05:08Z
- **Tasks:** 2
- **Files modified:** 2 (+1 phase-tracking append)

## Accomplishments

- **EVAL-01 live half delivered:** one command per provider kicks off `eval_coverage` via the real `POST /threads/{id}/messages` route (+`workflow_definition_id`, slug-resolved at runtime — never the hardcoded uuid), polls DB truth, and asserts: locked phase sequence completed in `phase_index` order, EXACTLY one `phase_completed` audit event per phase (HAVING-count double-execution detector + coverage check), ≥1 `search_documents` round-trip, and the D-02a robot-answered ask_user proceeding past the confirm phase.
- **Pitfall-1 honesty proven live:** the scoreboard reports `model_effective` from sub-agent `runs.model` rows — the live dry-run requested the PROVIDERS-constant model but the harness actually ran `gpt-4o` (the per-provider defaults table decides; curation is Plan 08's target and now has hard evidence).
- **Pitfall-2 race handled:** status + pending prompt are polled together every ~3s; a run that terminalizes before the answer lands records the distinct `terminal_before_answer` diagnostic, never a generic FAIL.
- **D-03 gating wired:** native-7 rows are the pass/fail bar (exit code 2 on any failure); openrouter prints BEST-EFFORT and never flips the gate; missing API keys mark the row MISSING and never block the matrix.
- **D-04 capability table:** full `--workflow` runs persist `capability-table-<date>.{json,md}` under `.planning/eval/` — measurement only, schema documented field-by-field in the new README; partial runs deliberately do not clobber.
- **D-01 part-2 gate documented:** the MANDATORY GATE ritual (run `--workflow` vs native-7, grep-diff `EVAL_ROW`, attach to VALIDATION) sits in the script's header docstring and in `.planning/eval/README.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Workflow row type — kickoff, DB-truth polling, D-02a auto-answer, assertions** - `0a271fc9` (feat)
2. **Task 2: D-04 capability-table emitter + D-01 part-2 operator-gate docs** - `010a484e` (feat)

## Files Created/Modified

- `scripts/eval_cross_provider.py` - +~700 lines additive: `--workflow` CLI flag, `_WORKFLOW_QUERIES` constant-SQL allowlist, `workflow_fetch`/`resolve_workflow_def`/`run_workflow_kickoff`/`resolve_workflow_run_id`/`post_ask_user_answer`/`run_workflow_cell`/`print_workflow_scoreboard`/`emit_capability_table`/`_run_workflow_matrix`; Deep-mode rows byte-untouched; entry-point discipline unchanged (`load_env` → `assert_localhost_only` FIRST → presence-only env report)
- `.planning/eval/README.md` - capability-table artifact format (JSON schema verbatim), emit trigger, grep ritual, v2.9 feature-fit consumer
- `.planning/phases/096-.../deferred-items.md` - appended DI-096-06-A (pre-existing double-encoded jsonb in harness writes)

## Decisions Made

- **model_effective from sub-agent rows first:** the plan's literal query (`SELECT DISTINCT model FROM runs WHERE thread_id = %s AND model IS NOT NULL`) would mix the producer shell's model in; the must-have truth says "from sub-agent runs.model rows", so the primary query filters `parent_run_id IS NOT NULL` with the plan's query kept as fallback for early-failure rows.
- **Full-run-only artifact emit:** "each full run persists a versioned table" — a same-day single-provider re-run printing one row must not overwrite a 8-row table; partial runs print an explicit not-written notice.
- **`arg_shape_ok: null` for workflow rows:** harness sub-agent tool args are never persisted in v2.8 — honesty over schema purity, documented in the README; the Deep-mode matrix continues to measure arg shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Live harness writes are double-encoded jsonb — plan's audit/grounding queries returned NULL slugs**
- **Found during:** Task 1 (live dry-run: audit_single_completion and tools_ok FAILed on a visibly perfect run)
- **Issue:** `harness_audit.metadata` (386/386 rows) and `workflow_phases.output` (95/99 rows) are jsonb STRINGS containing JSON, not jsonb objects — `metadata->>'phase'` / `output->'source_refs'` return NULL, so the plan's as-written detector and grounding queries could never pass
- **Fix:** all affected allowlist queries normalize BOTH shapes via `CASE WHEN jsonb_typeof(col) = 'string' THEN (col #>> '{}')::jsonb ELSE col END` (still constant strings + single %s param); the backend writer itself is out of scope (shared harness path) — logged as DI-096-06-A in deferred-items.md
- **Files modified:** scripts/eval_cross_provider.py
- **Verification:** re-ran the live dry-run — openai row flipped to PASS on all five assertion families
- **Committed in:** 0a271fc9 (Task 1 commit)

**2. [Rule 1 - Bug] Plan's tool-round-trip assertion assumed harness tool calls persist to messages.tool_calls — they don't**
- **Found during:** Task 1 (read of harness_engine.py:383 + task_service sub-agent loop)
- **Issue:** harness sub-agent transcripts are in-memory and the engine's final assistant message persists prose with NO tool_calls, so `get_tool_calls`/`assert_tool_invoked` alone would report tools_ok=False for every provider forever
- **Fix:** kept the plan's primary check and added the durable fallback: grounding harvested from `search_documents` ToolResults into `workflow_phases.output.source_refs` (F7, 092-07) — `tools_ok = invoked-in-messages OR grounded-phase-outputs > 0`
- **Files modified:** scripts/eval_cross_provider.py
- **Verification:** live dry-run shows 2 grounded phases (fanout + deep_dive) and the final message carrying 16 source_refs → tools_ok PASS
- **Committed in:** 0a271fc9 (Task 1 commit)

**3. [Minor] Plan referenced a `--providers` filter; the existing flag is `--provider` (singular)**
- **Found during:** Task 1 (CLI wiring)
- **Fix:** used the real existing flag; `--workflow --provider openai` works as the plan intended
- **Committed in:** 0a271fc9

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug) + 1 trivial naming correction
**Impact on plan:** Both fixes were required for the assertions to ever pass against real data; no scope creep — the backend-side root cause of #1 was deliberately NOT touched (logged to deferred-items.md).

## Issues Encountered

- **Live dry-run executed (plan-authorized):** the backend uvicorn was already up (operator-started), so per the plan's verification clause the executor ran `--workflow --provider openai` twice (before/after the Rule-1 query fix). Final result: `EVAL_ROW workflow openai gpt-4o PASS PASS PASS PASS PASS 0 54.5 completed PASS`, exit gate green. The full native-7 live run remains the operator's manual VALIDATION step (D-01 part 2).
- **Observation for Plan 08 (model curation):** the live effective sub-agent model for openai is `gpt-4o` — not the `gpt-5.4-mini` the PATTERNS-quoted defaults table suggests. The eval now surfaces exactly this drift; Plan 08's curation pass has its first data point.

## User Setup Required

None - no external service configuration required. The operator live gate needs the backend uvicorn + local Supabase up and provider keys present in `backend/.env` (presence-only checked).

## Next Phase Readiness

- The operator's first full native-7 `--workflow` run (VALIDATION.md manual-only) can run as-is; it will emit the first committed capability table.
- Plan 08 (model curation) inherits live evidence that the defaults table — not body.model — decides harness models (openai → gpt-4o today).
- DI-096-06-A (double-encoded jsonb in harness writes) is logged for any future plan touching `write_audit`/phase-output persistence.

---
*Phase: 096-eval-harness-cross-provider-verification-concurrency*
*Completed: 2026-06-07*

## Self-Check: PASSED

- scripts/eval_cross_provider.py: FOUND
- .planning/eval/README.md: FOUND
- 096-06-SUMMARY.md: FOUND
- deferred-items.md (DI-096-06-A appended): FOUND
- Commit 0a271fc9 (Task 1): FOUND
- Commit 010a484e (Task 2): FOUND
- py_compile + --help: green
- Live dry-run (--workflow --provider openai): PASS end-to-end
