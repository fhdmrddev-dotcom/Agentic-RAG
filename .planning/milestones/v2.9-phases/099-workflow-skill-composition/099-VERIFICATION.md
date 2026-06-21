---
phase: 099-workflow-skill-composition
verified: 2026-06-10T07:30:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/7
  gaps_closed:
    - "The skill's file manifest is populated and copied to the snapshot Storage prefix during materialization (CR-01)"
    - "read_skill_file routes to snapshot copies on the live harness path when ctx.skill_snapshot is present (CR-02)"
  gaps_remaining: []
  regressions: []
---

# Phase 099: Workflow Skill Composition Verification Report

**Phase Goal:** An authored workflow phase can pull in a project skill's judgment without breaking the locked, immutable definition or the Deep path.
**Verified:** 2026-06-10T07:30:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plans 099-05 and 099-06, commits 7a496829, 4371f2f0, 75b67eff, c13e7e74)

## Goal Achievement

All three pillars of the phase goal are now simultaneously true: (1) the agent sees the skill instructions + file manifest in its framing, (2) the immutable snapshot is materialized with a populated file manifest and `read_skill_file` routes to the snapshot copies on the live harness path, and (3) Deep mode is byte-identical. The two production-breaking defects identified in the initial verification (CR-01: empty file manifest, CR-02: snapshot-routing gate structurally unreachable) are both fixed, regression-locked, and confirmed against the actual codebase.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An llm_agent / llm_single / llm_batch_agents phase config can carry an optional skill_ref (UUID) and a pre-099 JSONB row still model_validate()s | ✓ VERIFIED | harness.py lines 73/90/109: skill_ref + skill_snapshot additive-optional on all 3 LLM configs with None defaults; structural validator _skill_snapshot_requires_ref present at line 204 |
| 2 | A phase with a skill_snapshot composes a '## Skill:' framing block into the system prompt (instructions + file manifest for agents, instructions-only for llm_single) | ✓ VERIFIED | phase_types.py: _skill_block helper (line 146) composed at all 3 executor seams (lines 319, 369, 438); llm_single uses with_files=False; _effective_tools auto-whitelists read_skill_file at line 188 |
| 3 | read_skill_file is auto-whitelisted on layer-1, layer-2, and sub-agent allowed_tools when a snapshot is present | ✓ VERIFIED | phase_types.py: _effective_tools (line 177) + _build_phase_tool_context (line 271): skill_snapshot=getattr(phase.config, "skill_snapshot", None) correctly attached; _effective_tools called at lines 347, 387, 424, 461 for all whitelist surfaces |
| 4 | Deep-mode chat is byte-identical — skill_snapshot=None on every non-skill-phase caller means the snapshot gate is a literal no-op | ✓ VERIFIED | tool_dispatcher.py line 478: gate is getattr(ctx, 'skill_snapshot', None); ToolContext.skill_snapshot defaults None (line 114); parent_ctx.skill_snapshot is None for all Deep/tasks callers so propagation is a no-op at task_service.py line 636 |
| 5 | The skill's file manifest is populated and copied to the snapshot Storage prefix during materialization | ✓ VERIFIED (CR-01 CLOSED) | skill_snapshot.py lines 199-205: the broken row.get("files") line is removed; replaced with await aexec(supabase.table("skill_files").select("filename").eq("skill_id", str(skill_ref)).order("filename")); filenames list-comprehended from _files_resp.data; SkillSnapshot.files=filenames at line 231; Storage-copy loop at lines 212-224; de-mocked fakes model the real two-table shape (_FakeSkillFilesQuery confirmed at line 517). Commit 7a496829 (fix), 4371f2f0 (test de-mock). |
| 6 | read_skill_file routes to snapshot copies on the live harness path when ctx.skill_snapshot is present | ✓ VERIFIED (CR-02 CLOSED) | task_service.py line 636: skill_snapshot=parent_ctx.skill_snapshot added to sub_ctx ToolContext construction, immediately after workflow_run_id; comment references CR-02 + 096-02 precedent. Gate at tool_dispatcher.py line 479 is now reachable on the live path. test_099_snapshot_routing_live_chain drives the REAL run_task_sub_agent -> dispatch_tool chain via ScriptedGateway, asserts the read_skill_file leaf received a non-None ctx.skill_snapshot with the correct storage_prefix. Commit 75b67eff (fix), c13e7e74 (regression test). |
| 7 | A materializer runs at kickoff, validates skill_refs (ValueError→400 on missing/disabled/not-visible), and persists the snapshot for subsequent runs | ✓ VERIFIED | threads.py line 787: _ensure_skill_snapshots helper; called at kickoff line 931; validate_skill_refs + materialize_skill_snapshots_if_needed wired via the module object (_skill_snapshot) at lines 808, 816; ValueError→400 mapping correct. File manifest population (the partial in initial verification) is now fully satisfied by CR-01 fix. |

**Score:** 7/7 truths verified

### Re-verification: Previously Failed Items

**CR-01 (Truth #5) — CLOSED:**

The initial verification found `skill_snapshot.py` line 185 read `row.get("files")` from a `skills` table row that has no `files` column, producing an empty manifest in production. The fix at commit 7a496829 replaces that broken line with a `skill_files` table query (`supabase.table("skill_files").select("filename").eq("skill_id", str(skill_ref)).order("filename")`) wrapped in `aexec`, keyed by the validated `skill_ref` UUID — exactly mirroring `_handle_load_skill` in `tool_dispatcher.py:375-383`. Grep confirms:
- `table("skill_files")` present at lines 200-203 inside `materialize_skill_snapshots`
- `filenames = [f["filename"] for f in (_files_resp.data or [])]` at line 205
- `row.get("files")` has NO matches remaining in the file

The test fakes (commit 4371f2f0) were de-mocked: `_FakeSkillsDB` now takes `(skill_rows, skill_files=None)` and routes by table name; `_FakeSkillFilesQuery` (line 517) models the fluent chain; no skills row carries a phantom `files` key; the two materialize tests seed `skill_files={str(skill_id): ["rubric.md"]}` as a separate arg.

**CR-02 (Truth #6) — CLOSED:**

The initial verification found `run_task_sub_agent` in `task_service.py` built `sub_ctx = ToolContext(...)` propagating `phase_whitelist` and `workflow_run_id` but not `skill_snapshot`, making the snapshot-routing gate at `tool_dispatcher.py:479` structurally unreachable. The fix at commit 75b67eff adds `skill_snapshot=parent_ctx.skill_snapshot` (line 636) immediately after `workflow_run_id=parent_ctx.workflow_run_id,` with a CR-02/096-02-precedent comment. Grep confirms exactly one match inside `run_task_sub_agent`.

The live-chain regression test (commit c13e7e74, `test_099_snapshot_routing_live_chain`) drives the REAL `harness_engine.run_workflow` -> REAL `run_task_sub_agent` -> REAL `dispatch_tool` via `ScriptedGateway`, scripts a `read_skill_file` tool call in a skill-bearing `llm_batch_agents` phase, and captures `ctx.skill_snapshot` at the substituted leaf. The assertion `captured["snapshot"].storage_prefix == snap.storage_prefix` was empirically verified to fail pre-fix (`None`) and pass post-fix.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/harness.py` | skill_ref + SkillSnapshot on all 3 LLM configs + structural validator | ✓ VERIFIED | SkillSnapshot model at lines 33-48; skill_ref + skill_snapshot on LlmSinglePhaseConfig (lines 73-74), LlmAgentPhaseConfig (lines 90-91), LlmBatchAgentsPhaseConfig (lines 109-110); _skill_snapshot_requires_ref validator at line 204 |
| `backend/app/services/harness/skill_snapshot.py` | validate_skill_refs + materialize_skill_snapshots; file manifest from skill_files table | ✓ VERIFIED | CR-01 fixed: table("skill_files") query at lines 199-205; broken row.get("files") removed; SkillSnapshot.files=filenames at line 231; Storage-copy loop at lines 212-224 |
| `backend/app/services/harness/phase_types.py` | _skill_block + _effective_tools + auto-whitelist + snapshot ctx attach | ✓ VERIFIED | All implementations correct and unchanged from initial verification |
| `backend/app/services/tool_dispatcher.py` | ToolContext.skill_snapshot field + gated snapshot-routing branch | ✓ VERIFIED | Field at line 114; gate at line 478-479; now reachable on live path (CR-02 fixed in task_service.py) |
| `backend/app/api/threads.py` | _ensure_skill_snapshots helper + kickoff wiring | ✓ VERIFIED | Import at line 50; _ensure_skill_snapshots at line 787; called at kickoff line 931 |
| `backend/tests/test_099_skill_composition.py` | 10 named tests, all GREEN; de-mocked two-table fakes | ✓ VERIFIED | _FakeSkillsDB models two tables (line 460-478); _FakeSkillFilesQuery at line 517; no skills row carries 'files' key; test suite 10 passed post-fix |
| `backend/tests/test_096_ci_workflow_regression.py` | test_099_snapshot_routing_live_chain live-chain regression test | ✓ VERIFIED | test_099_snapshot_routing_live_chain at line 679; real dispatch chain; sentinel captures ctx.skill_snapshot; assertion references CR-02; was empirically verified to fail pre-fix |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `skill_snapshot.py materialize` | `skill_files table` | aexec(supabase.table("skill_files").select("filename").eq("skill_id", str(skill_ref)).order("filename")) | ✓ WIRED | CR-01 closed: lines 199-205; mirrors _handle_load_skill in tool_dispatcher.py:375-383 |
| `phase_types.py _build_phase_tool_context` | `ToolContext.skill_snapshot` | skill_snapshot= param | ✓ WIRED | Line 271: skill_snapshot=getattr(phase.config, "skill_snapshot", None) — unchanged, still correct |
| `task_service.py sub_ctx` | `parent_ctx.skill_snapshot` | propagation in ToolContext construction | ✓ WIRED | CR-02 closed: line 636 skill_snapshot=parent_ctx.skill_snapshot added after workflow_run_id |
| `tool_dispatcher.py _handle_read_skill_file` | `ctx.skill_snapshot.storage_prefix` | snapshot gate at line 479 | ✓ REACHABLE | CR-02 closed: sub_ctx now carries snapshot; gate is live on the harness path; regression-locked |
| `threads.py kickoff` | `skill_snapshot.py` | _ensure_skill_snapshots | ✓ WIRED | Lines 807-819: validate_skill_refs + materialize_skill_snapshots_if_needed via module object |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `skill_snapshot.py materialize: filenames` | filenames list | skill_files table query via aexec, keyed by validated skill_ref | Yes — rows from skill_files table, ordered by filename | ✓ FLOWING (CR-01 fixed) |
| `tool_dispatcher.py _handle_read_skill_file: snapshot branch` | ctx.skill_snapshot | parent_ctx propagated via sub_ctx (task_service.py line 636) | Yes — SkillSnapshot model with populated files list | ✓ FLOWING (CR-02 fixed) |
| `phase_types.py _skill_block: snap.files` | snap.files from SkillSnapshot | set by fixed materializer from real skill_files rows | Yes — file manifest is non-empty when skill has attached files | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for Deep-mode path (byte-identical by design, no server required). The relevant behavioral checks were verified analytically and via the regression test suite.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| skill_snapshot.py queries skill_files table | grep "table(\"skill_files\")" skill_snapshot.py | Match at lines 200-203 inside materialize_skill_snapshots | ✓ PASS |
| Broken row.get("files") removed | grep "row.get(\"files\")" skill_snapshot.py | No matches | ✓ PASS |
| skill_snapshot propagated in sub_ctx | grep "skill_snapshot=parent_ctx.skill_snapshot" task_service.py | Match at line 636 inside run_task_sub_agent | ✓ PASS |
| _FakeSkillFilesQuery models real two-table shape | grep "class _FakeSkillFilesQuery" test_099_skill_composition.py | Match at line 517 | ✓ PASS |
| No phantom 'files' key on skills rows | grep '"files": \[' test_099_skill_composition.py | No matches on skills-row literals | ✓ PASS |
| Live-chain regression test present | grep "def test_099_snapshot_routing_live_chain" test_096_ci_workflow_regression.py | Match at line 679 | ✓ PASS |
| Test suite passes (64 tests) | pytest test_099 + test_096 + test_098 + test_085 suites | 64 passed (orchestrator-reported post-merge) | ✓ PASS |
| Broader regression sweep | pytest 093/094/095/096/098/099/085 suites | 124 passed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WFSKILL-01 | 099-01, 02, 03, 04, 05, 06 | llm_agent/llm_single phase can reference a skill via skill_ref; instructions + files compose into phase framing; read_skill_file auto-whitelisted; skill snapshotted so edit/delete can't break a published workflow; Deep path byte-identical | ✓ SATISFIED | All 5 clauses verified: (a) skill_ref additive-optional on all 3 LLM configs — T1; (b) instructions + file manifest compose into phase framing — T2; (c) read_skill_file auto-whitelisted — T3; (d) file manifest sourced from skill_files table, Storage-copied, immutable — T5+T7 (CR-01 closed); (e) snapshot-routing gate reachable on live path — T6 (CR-02 closed); (f) Deep byte-identical — T4 |

### Anti-Patterns Found

No new anti-patterns. The five blocker anti-patterns identified in the initial verification are all resolved:

| Original Issue | Resolution |
|----------------|-----------|
| skill_snapshot.py line 185: row.get("files") reads nonexistent column | FIXED — commit 7a496829: replaced with skill_files table query |
| skill_snapshot.py _SKILL_SELECT had no 'files' column | CORRECT — no 'files' column was added; query is separate (by design) |
| task_service.py sub_ctx missing skill_snapshot propagation | FIXED — commit 75b67eff: skill_snapshot=parent_ctx.skill_snapshot at line 636 |
| test_099: _FakeSkillsDB rows carried phantom 'files' key | FIXED — commit 4371f2f0: two-table model, no phantom column |
| test_099: test_snapshot_routing injected snapshot directly onto handler ctx | FIXED — commit 4371f2f0 (fakes) + c13e7e74 (live-chain regression test via real dispatch chain) |

### Human Verification Required

No human verification items — all truths are analytically verified from source code and confirmed by the regression test suite reported by the orchestrator (64 passed + broader 124 passed sweep).

### Gaps Summary

No gaps. All 7 must-haves are verified. The two production-breaking defects identified in the initial verification are both closed:

- CR-01 (file manifest always empty): the `skill_files` table query replaces the broken `row.get("files")` call; the test fakes model the real two-table schema. Regression-locked by the de-mocked `test_snapshot_materialize` and `test_snapshot_immune_to_live_edit`.
- CR-02 (snapshot-routing gate structurally unreachable): `skill_snapshot=parent_ctx.skill_snapshot` propagates the snapshot onto `sub_ctx` in `run_task_sub_agent`. Regression-locked by `test_099_snapshot_routing_live_chain` which drives the real dispatch chain and fails pre-fix.

Both fixes are additive and follow the codebase's established patterns (mirroring `_handle_load_skill` for CR-01; mirroring the 096-02 `phase_whitelist` fix for CR-02). The Deep path remains byte-identical — `parent_ctx.skill_snapshot` is `None` for all Deep/tasks callers so the propagation is a literal no-op outside workflow skill phases.

---

_Verified: 2026-06-10T07:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after: Plans 099-05 (CR-01, commits 7a496829 + 4371f2f0) and 099-06 (CR-02, commits 75b67eff + c13e7e74)_
