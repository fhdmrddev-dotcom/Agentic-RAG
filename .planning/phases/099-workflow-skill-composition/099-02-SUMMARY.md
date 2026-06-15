---
phase: 099-workflow-skill-composition
plan: 02
subsystem: api
tags: [harness, workflow, skills, tool-dispatcher, system-prompt, whitelist, tdd]

# Dependency graph
requires:
  - phase: 099-01
    provides: "SkillSnapshot(_StrictBase) + skill_ref/skill_snapshot additive-optional configs + ToolContext.skill_snapshot field + the 2 Plan-02 TDD stubs"
provides:
  - "_skill_block(phase, ctx, *, with_files) helper — the delimited '## Skill:' framing block ('' when no snapshot, byte-identical no-op)"
  - "Skill framing composed at the system_prompt seam in all 3 LLM executors (llm_single omits the file manifest — D-07)"
  - "_effective_tools(phase) helper — available_tools u {read_skill_file} when a snapshot is present (D-04 auto-whitelist; never drops a tool)"
  - "read_skill_file auto-whitelisted on layer-1 (model-visible budget), layer-2 (phase_whitelist), AND the sub-agent allowed_tools subset"
  - "skill_snapshot attached onto the per-phase ToolContext at _build_phase_tool_context (Plan 03's gated read branch consumes it)"
affects: [099-03 (gated read branch consumes ctx.skill_snapshot + the auto-whitelisted read_skill_file), 099-04 (threads.py kickoff wiring materializes the snapshot the framing reads)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "'' -on-absent no-op helper (mirrors _retry_suffix) — _skill_block returns '' when no snapshot so a non-skill phase composes byte-identically to pre-099"
    - "Compute-once effective tool list feeding BOTH whitelist layers — _effective_tools(phase) derives available_tools + phase_whitelist from one source so layer-1 and layer-2 never drift"
    - "Auto-whitelist by exactly-one-fixed-tool (T-099-07) — the snapshot presence appends only the already-registered read_skill_file, never arbitrary names"
    - "Phase-shape-derived framing variant — with_files auto-derives from llm_single / empty available_tools so the (phase, ctx) test contract composes correctly without a kwarg"

key-files:
  created: []
  modified:
    - backend/app/services/harness/phase_types.py
    - backend/tests/test_099_skill_composition.py

key-decisions:
  - "_skill_block signature reconciled to (phase, ctx=None, *, with_files=None) — the Plan-02 TDD stub calls _skill_block(phase, ctx) positionally and infers the file-list omission from the phase shape, so with_files auto-derives (llm_single / empty available_tools => omit) while the executor seams still pass the explicit with_files=False for llm_single (satisfies both the test contract and the plan's acceptance greps)"
  - "snapshot attached from phase.config.skill_snapshot (not ctx.skill_snapshot) — the phase config is the source of truth inside the locked WorkflowDefinition; the harness ctx bag never carries it"
  - "allowed_tools= on run_task_sub_agent switched to _effective_tools(phase) in both agent executors — layer-1 exposing read_skill_file is useless if the sub-agent's own allowed_tools subset rejects it; both must agree"

patterns-established:
  - "Skill framing is provider-agnostic by construction — one composed system string at the shared seam, no per-provider branch (the agent experiences a workflow skill exactly like load_skill in Deep chat: instructions + a file list, contents on demand)"
  - "Every 099 path is gated on getattr(phase.config, 'skill_snapshot', None) — None => '' block, unchanged whitelist, skill_snapshot=None on the ctx => Plan 03 read is a no-op (T-099-05 red-line: Deep byte-identical)"

requirements-completed: [WFSKILL-01]

# Metrics
duration: 35min
completed: 2026-06-09
---

# Phase 099 Plan 02: Workflow ↔ Skill Composition (framing + auto-whitelist) Summary

**`_skill_block` composes the materialized snapshot (instructions + on-demand file manifest) into the single system-prompt seam in all 3 LLM executors, `read_skill_file` is auto-whitelisted on both budget layers + the sub-agent subset, and the snapshot is threaded onto the per-phase `ToolContext` — every path a literal no-op when no snapshot is present.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-09T23:11:00Z
- **Completed:** 2026-06-09T23:46:00Z
- **Tasks:** 2
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments

- **`_skill_block(phase, ctx, *, with_files)` helper** — mirrors `_retry_suffix`'s `'' -on-absent` shape: returns `""` when `phase.config.skill_snapshot is None` (a byte-identical no-op), else a delimited `"\n\n## Skill: {name}\n{instructions}"` block. When `with_files` (the agent-phase default) it appends the snapshot's file-NAME manifest under "Attached files (read with read_skill_file)" — names, not contents (D-06), exactly as `load_skill` composes.
- **Composed at the `system_prompt =` seam in all 3 executors** BEFORE `_retry_suffix` (lean per D-05): `_exec_llm_single` passes `with_files=False` (D-07 — `tools=[]`, `read_skill_file` inert, manifest omitted), `_exec_llm_agent` + `_exec_llm_batch_agents` compose the full block.
- **`_effective_tools(phase)` helper (D-04 auto-whitelist)** — `available_tools u {"read_skill_file"}` when the phase carries a snapshot; never drops a tool; unchanged (byte-identical) otherwise. Adds exactly one fixed, already-registered tool name and only when a snapshot is present (T-099-07).
- **`read_skill_file` auto-whitelisted on all three relevant surfaces** — layer-1 (the `apply_tool_budget` whitelist the model's tool schemas are capped to), layer-2 (`phase_whitelist`, the dispatch-time backstop), and the sub-agent's own `allowed_tools=` subset in both agent executors (otherwise layer-1 exposes it but the sub-agent rejects the call).
- **Snapshot attached onto the per-phase `ToolContext`** — `_build_phase_tool_context` now sets `skill_snapshot=getattr(phase.config, "skill_snapshot", None)`; `None` on every Deep / non-skill phase => Plan 03's gated read branch is a literal no-op.
- **Both Plan-02 TDD stubs flipped GREEN** — `test_skill_block_compose` + `test_auto_whitelist` un-xfailed and passing; the 098 narrowing block left exactly as-is (additive alongside).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add `_skill_block` helper + compose it at the seam in all 3 executors** — `3b638c7a` (feat, TDD GREEN — flips `test_skill_block_compose`)
2. **Task 2: Auto-whitelist `read_skill_file` on both layers + attach snapshot onto the per-phase `ToolContext`** — `46426f78` (feat, TDD GREEN — flips `test_auto_whitelist`)

**Plan metadata:** (this SUMMARY + STATE + ROADMAP + deferred-items) committed separately.

_Note: this plan's TDD tasks reuse the Plan-01 cross-plan test scaffold as the RED gate (the 2 stubs were authored xfail in Plan 01), so each GREEN task is a single `feat` commit that un-xfails its stub rather than a test->feat pair._

## Files Created/Modified

- `backend/app/services/harness/phase_types.py` (modified) — `_skill_block` + `_effective_tools` helpers; `_skill_block` composed at the `system_prompt` seam in `_exec_llm_single` (`with_files=False`), `_exec_llm_agent`, `_exec_llm_batch_agents`; `_build_phase_tool_context` derives `available_tools=_tools` + `phase_whitelist=frozenset(_tools)` from `_effective_tools(phase)` and attaches `skill_snapshot`; both agent executors derive layer-1 `whitelist` and `allowed_tools=` from `_effective_tools(phase)`.
- `backend/tests/test_099_skill_composition.py` (modified) — removed the `@pytest.mark.xfail` markers from `test_skill_block_compose` and `test_auto_whitelist` (now true GREEN).

## Decisions Made

- **`_skill_block` signature reconciled to the test contract.** The plan prose specified `_skill_block(phase, *, with_files: bool = True)`, but the Plan-01 TDD stub (the binding contract) calls `_skill_block(_phase(...), _harness_ctx(...))` positionally with two args and never passes `with_files` — it expects the llm_single file-list omission to be inferred from the phase shape (`phase_type="llm_single"` / `available_tools=[]`). I made the signature `_skill_block(phase, ctx=None, *, with_files: bool | None = None)`: `with_files` auto-derives from the phase when not passed, while the three executor seams still pass `with_files=False` explicitly for `llm_single`. This satisfies BOTH the test (`(phase, ctx)` positional) AND the plan's acceptance greps (`with_files=False` matches exactly once at the llm_single call). No behavior diverges from the plan's intent — llm_single omits the manifest either way.
- **Snapshot attached from `phase.config.skill_snapshot`, not `ctx.skill_snapshot`.** The materialized snapshot lives inside the locked `WorkflowDefinition` (the phase config), which is the source of truth; the harness ctx bag never carries it. The test's `_harness_ctx` also sets `skill_snapshot` but the assertion (`tc.skill_snapshot is snap`) holds because the same `snap` object is on `phase.config`.
- **`allowed_tools=` switched to `_effective_tools(phase)` in both agent executors.** The plan flagged this explicitly: layer-1 exposing `read_skill_file` is inert if `run_task_sub_agent`'s own `allowed_tools` subset rejects it. Both `_exec_llm_agent` (the single sub-agent) and `_exec_llm_batch_agents` (each `_one` branch) now pass the effective list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `_skill_block` signature reconciled to the (phase, ctx) test contract**
- **Found during:** Task 1 (`_skill_block` helper)
- **Issue:** The plan's literal signature `_skill_block(phase, *, with_files: bool = True)` is incompatible with the binding Plan-01 TDD stub, which calls `_skill_block(phase, ctx)` positionally (two args) and infers the llm_single manifest omission from the phase shape, never passing `with_files`. Implementing the plan's exact signature would make `test_skill_block_compose` raise `TypeError` (unexpected positional arg).
- **Fix:** Signature is `_skill_block(phase, ctx=None, *, with_files: bool | None = None)`. `with_files` auto-derives from the phase shape (`llm_single` / empty `available_tools` => omit the manifest) when not explicitly passed; the executor seams still pass `with_files=False` for `llm_single`. The plan's intent (llm_single omits the file list; agents include it; `''` when no snapshot) is preserved exactly.
- **Files modified:** `backend/app/services/harness/phase_types.py`
- **Verification:** `test_skill_block_compose` GREEN (asserts `''` on no-snapshot, `## Skill:` + instructions present, `rubric.md` listed on the agent phase, `rubric.md` ABSENT on the llm_single phase).
- **Committed in:** `3b638c7a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — test-contract reconciliation).
**Impact on plan:** The deviation is a signature reconciliation that preserves the plan's exact behavioral intent and satisfies every acceptance grep. No scope creep. All other plan instructions (seam placement, both whitelist layers, sub-agent allowed_tools, ctx attach, the 098 narrowing block left untouched) executed exactly as written.

## Issues Encountered

- **Pre-existing harness-gates failure (out of scope).** The full-suite + harness regression run surfaced `tests/test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts` failing with `KeyError: 'tool_call_id'`. Stashing the Plan-02 changes and re-running at the phase base (`0341e879`) reproduced the identical failure — it is **pre-existing rot, NOT a regression** from this plan (a no-snapshot phase composes `''` and the whitelist is unchanged, so the gate-retry path is byte-identical). Per the SCOPE BOUNDARY rule it was NOT fixed; logged to `.planning/phases/099-workflow-skill-composition/deferred-items.md`. All other harness gate tests pass (10 passed, 1 deselected).
- **Full-suite baseline rot unchanged.** `pytest tests/ -q` reports the same documented pre-existing failure clusters (`test_sql_service`, `test_streaming_reliability`, `test_077_cross_cancel`, etc. — catalogued in Plan 01's SUMMARY). My added tests (`test_099_skill_composition.py`) have **0 failures**; net-new failures from this plan = 0.

## Known Stubs

None that block the plan's goal. The snapshot ctx attach (`ToolContext.skill_snapshot`) and the auto-whitelisted `read_skill_file` are consumed by Plan 03's gated read branch (`_handle_read_skill_file`), which is the explicitly-scoped next plan — this is a planned cross-plan seam (the data contract + the consumer are split across Plans 01/02/03 by design), not a placeholder. When no snapshot is present every path is a literal no-op, so nothing is left half-wired on the Deep / non-skill path.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 03** (gated read branch + publish gate + materializer) now has its full upstream contract: `ctx.skill_snapshot` is attached on the per-phase `ToolContext`, `read_skill_file` is auto-whitelisted so the model can actually call it, and the framing names the manifest files the agent will read on demand. Plan 03 fills `_handle_read_skill_file`'s snapshot branch + `skill_snapshot.py` (`validate_skill_refs` / `materialize_skill_snapshots`). Its 5 stubs remain xfail-ready.
- **Plan 04** (threads.py kickoff wiring) materializes the snapshot the framing reads; no change needed to the framing seam.
- WFSKILL-01 stays OPEN in REQUIREMENTS.md until phase close (the composition behavior is now live, but the read-routing + publish-gate ship in Plans 03/04).
- No blockers.

## Self-Check: PASSED

- Files: `099-02-SUMMARY.md`, `backend/app/services/harness/phase_types.py`, `backend/tests/test_099_skill_composition.py`, `deferred-items.md` — all FOUND.
- Commits: `3b638c7a`, `46426f78` — all FOUND.
- `pytest tests/test_099_skill_composition.py -q` → 4 passed / 5 xfailed / 1 xpassed (the 2 Plan-02 stubs now GREEN). Harness + 098 regression: 95 passed; harness gates 10 passed (1 pre-existing failure deselected → deferred-items.md). Net-new full-suite failures = 0.

---
*Phase: 099-workflow-skill-composition*
*Completed: 2026-06-09*
