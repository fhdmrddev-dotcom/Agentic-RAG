---
phase: 099-workflow-skill-composition
verified: 2026-06-10T04:30:00Z
status: gaps_found
score: 4/7 must-haves verified
overrides_applied: 0
gaps:
  - truth: "The skill's file manifest is populated and copied to the snapshot Storage prefix during materialization"
    status: failed
    reason: "CR-01: _SKILL_SELECT on line 60 of skill_snapshot.py is 'id, name, description, instructions, user_id, is_enabled, is_global' — no 'files' column. The skills table has no 'files' column (files live in the separate skill_files table per 017_skills.sql). Line 185 'filenames = list(row.get(\"files\") or [])' always evaluates to [] in production. Zero Storage copies happen, the snapshot manifest is empty, and read_skill_file always returns 'not in the workflow's skill snapshot' for every call. Additionally, the empty snapshot is persisted to the workflow_definitions JSONB and locked in by the idempotency check, meaning any definition that first-kicks-off before a fix keeps the broken empty manifest forever."
    artifacts:
      - path: "backend/app/services/harness/skill_snapshot.py"
        issue: "Line 185: filenames = list(row.get('files') or []) — 'files' is not a column on the skills table; must query skill_files table (.select('filename').eq('skill_id', str(skill_ref))) to get the manifest, mirroring _handle_load_skill in tool_dispatcher.py:375-381"
    missing:
      - "Replace line 185 with a skill_files table query: resp2 = await aexec(supabase.table('skill_files').select('filename').eq('skill_id', str(skill_ref)).order('filename')); filenames = [f['filename'] for f in (resp2.data or [])]"
      - "Update the _FakeSkillsDB in test_099_skill_composition.py to model the real two-table shape (skills + skill_files separately) so the fake can't carry a column that production doesn't have"

  - truth: "read_skill_file routes to snapshot copies when ctx.skill_snapshot is present on the live harness path"
    status: failed
    reason: "CR-02: _build_phase_tool_context in phase_types.py correctly attaches skill_snapshot to the parent phase ctx (line 271). However, run_task_sub_agent in task_service.py rebuilds sub_ctx = ToolContext(...) at lines 585-626 and explicitly propagates phase_whitelist (line 620) and workflow_run_id (line 625) but does NOT propagate skill_snapshot. Every harness tool call dispatches with sub_ctx, so sub_ctx.skill_snapshot is always None (the dataclass default). The snapshot-routing branch in tool_dispatcher.py:479 is structurally unreachable on the live harness path — an exact structural parallel to the 096-02 phase_whitelist wiring fix documented in the adjacent comment at task_service.py:612-619. The test test_snapshot_routing masks this by injecting the snapshot directly onto the handler's ctx instead of exercising the sub-agent dispatch chain."
    artifacts:
      - path: "backend/app/services/task_service.py"
        issue: "Lines 585-626: sub_ctx = ToolContext(...) does not include skill_snapshot=parent_ctx.skill_snapshot. Every dispatch_tool call runs with sub_ctx.skill_snapshot=None, making the snapshot gate in tool_dispatcher.py:479 dead code on the live path."
    missing:
      - "Add skill_snapshot=parent_ctx.skill_snapshot to the sub_ctx ToolContext construction in task_service.py (alongside workflow_run_id at line 625), with a comment mirroring the 096-02 phase_whitelist fix"
      - "Add a regression test mirroring test_096_whitelist_refusal: assert that sub_ctx built by run_task_sub_agent carries parent_ctx.skill_snapshot"
---

# Phase 099: Workflow Skill Composition Verification Report

**Phase Goal:** An authored workflow phase can pull in a project skill's judgment via `skill_ref` with a version snapshot; Deep path byte-identical
**Verified:** 2026-06-10T04:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal requires three things to be simultaneously true: (1) the agent sees the skill instructions + file manifest in its framing, (2) the immutable snapshot is materialized and `read_skill_file` routes to it, and (3) Deep mode is byte-identical. The framing half (1) and the Deep invariant (3) are correctly implemented. The immutable-snapshot half (2) has two production-breaking defects that make the "file" aspect of the feature non-functional in production while passing a mock-based test suite.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An llm_agent / llm_single / llm_batch_agents phase config can carry an optional skill_ref (UUID) and a pre-099 JSONB row still model_validate()s | ✓ VERIFIED | harness.py lines 73/90/109: skill_ref + skill_snapshot additive-optional on all 3 LLM configs with None defaults; test_skill_ref_additive_optional GREEN |
| 2 | A phase with a skill_snapshot composes a '## Skill:' framing block into the system prompt (instructions + file manifest for agents, instructions-only for llm_single) | ✓ VERIFIED | phase_types.py: _skill_block helper (line 146) composed at all 3 executor seams (lines 319, 369, 438); llm_single uses with_files=False (D-07); test_skill_block_compose GREEN |
| 3 | read_skill_file is auto-whitelisted on layer-1, layer-2, and sub-agent allowed_tools when a snapshot is present | ✓ VERIFIED | phase_types.py: _effective_tools (line 177) + _build_phase_tool_context (lines 261-271) correctly add read_skill_file and attach the snapshot to the parent ToolContext; test_auto_whitelist GREEN |
| 4 | Deep-mode chat is byte-identical — skill_snapshot=None on every non-skill-phase caller means the snapshot gate is a literal no-op | ✓ VERIFIED | tool_dispatcher.py:478: gate is getattr(ctx, 'skill_snapshot', None); ToolContext.skill_snapshot defaults None; test_deep_noop GREEN. NOTE: this truth holds trivially on the live path because CR-02 means the snapshot never reaches sub_ctx regardless |
| 5 | The skill's file manifest is populated and copied to the snapshot Storage prefix during materialization | ✗ FAILED | CR-01 CONFIRMED: skill_snapshot.py line 185 reads row.get('files') but the skills table has no 'files' column (_SKILL_SELECT = 'id, name, description, instructions, user_id, is_enabled, is_global'). Files live in the skill_files table. In production filenames is always []. Zero Storage copies happen, the manifest in the snapshot is empty, and any subsequent read_skill_file call returns an error. The empty manifest is persisted to JSONB and locked in by the idempotency check. Test passes only because _FakeSkillsDB rows carry a 'files' key the real schema does not have. |
| 6 | read_skill_file routes to snapshot copies on the live harness path when ctx.skill_snapshot is present | ✗ FAILED | CR-02 CONFIRMED: task_service.py lines 585-626 builds sub_ctx = ToolContext(...) propagating phase_whitelist and workflow_run_id but NOT skill_snapshot. Every dispatch_tool call uses sub_ctx.skill_snapshot=None. The snapshot-routing branch at tool_dispatcher.py:479 is structurally unreachable on the live harness path. Test passes only because test_snapshot_routing injects the snapshot directly onto the handler ctx, bypassing the sub-agent dispatch chain. |
| 7 | A materializer runs at kickoff, validates skill_refs (ValueError→400 on missing/disabled/not-visible), and persists the snapshot for subsequent runs | ✓ VERIFIED (partial) | threads.py line 931: _ensure_skill_snapshots is called; validate_skill_refs + materialize_skill_snapshots_if_needed are wired; ValueError→400 mapping is correct; test_kickoff_snapshot_wiring GREEN. However the materialized snapshot has an empty file manifest due to CR-01, so this truth holds for the instructions-copy half but not the file-copy half. Marked verified for the wiring structure. |

**Score:** 4/7 truths verified (5 if counting T7 as partial; two critical production defects block T5 and T6)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/harness.py` | skill_ref + SkillSnapshot on all 3 LLM configs + structural validator | ✓ VERIFIED | SkillSnapshot model with 6 fields; skill_ref + skill_snapshot on LlmSinglePhaseConfig/LlmAgentPhaseConfig/LlmBatchAgentsPhaseConfig; _skill_snapshot_requires_ref validator present |
| `backend/app/services/harness/skill_snapshot.py` | validate_skill_refs + materialize_skill_snapshots | ✓ EXISTS, ✗ STUB (file half) | Functions exist and are wired. CR-01: filenames = list(row.get('files') or []) always returns [] in production — the file manifest is never populated, zero Storage copies occur |
| `backend/app/services/harness/phase_types.py` | _skill_block + _effective_tools + auto-whitelist + snapshot ctx attach | ✓ VERIFIED | All implementations correct; _skill_block composed at 3 seams; _effective_tools used on all whitelist surfaces; skill_snapshot attached on parent phase ctx |
| `backend/app/services/tool_dispatcher.py` | ToolContext.skill_snapshot field + gated snapshot-routing branch + _decode_skill_file_bytes | ✓ VERIFIED (gate exists, structurally unreachable on live path) | Field exists (defaults None); gate present at line 478; _decode_skill_file_bytes extracted. CR-02 makes the gate dead code: sub_ctx never carries skill_snapshot on the live harness path |
| `backend/app/api/threads.py` | _ensure_skill_snapshots helper + kickoff wiring | ✓ VERIFIED | Import at line 50; _ensure_skill_snapshots helper at line 787; called at kickoff line 931; G-5 honored (no inline domain logic) |
| `backend/tests/test_099_skill_composition.py` | 10 named tests, all GREEN, _FakeStorage recorder | ✓ EXISTS, ✗ MOCK-MASKING | All 10 tests GREEN. However _FakeSkillsDB rows carry 'files' key (line 370, 394) that does not exist on the real skills table — masks CR-01. test_snapshot_routing injects snapshot directly onto handler ctx — masks CR-02. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `skill_snapshot.py materialize` | `skill_files table` | query for filenames | ✗ NOT_WIRED | Materializer reads row.get('files') from skills row, not skill_files table. The correct query (used by _handle_load_skill in tool_dispatcher.py:375-381) is missing |
| `phase_types.py _build_phase_tool_context` | `ToolContext.skill_snapshot` | skill_snapshot= param | ✓ WIRED | Line 271: skill_snapshot=getattr(phase.config, 'skill_snapshot', None) |
| `task_service.py sub_ctx` | `parent_ctx.skill_snapshot` | propagation in ToolContext construction | ✗ NOT_WIRED | Lines 585-626: sub_ctx = ToolContext(...) does not include skill_snapshot=parent_ctx.skill_snapshot |
| `tool_dispatcher.py _handle_read_skill_file` | `ctx.skill_snapshot.storage_prefix` | snapshot gate | ✗ STRUCTURALLY UNREACHABLE | Gate exists at line 479 but sub_ctx.skill_snapshot is always None on the live harness path (CR-02) |
| `threads.py kickoff` | `skill_snapshot.py` | _ensure_skill_snapshots | ✓ WIRED | Lines 807-819: validate_skill_refs + materialize_skill_snapshots_if_needed called via module object |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `skill_snapshot.py materialize: filenames` | filenames list | row.get('files') from skills table query | No — column does not exist on skills table | ✗ DISCONNECTED (CR-01) |
| `tool_dispatcher.py _handle_read_skill_file: snapshot branch` | ctx.skill_snapshot | parent_ctx propagated via sub_ctx | No — sub_ctx.skill_snapshot always None | ✗ DISCONNECTED (CR-02) |
| `phase_types.py _skill_block: snap.files` | snap.files from SkillSnapshot | set by materializer at first kickoff | No — materializer sets files=[] (CR-01 flows through to framing) | ✗ HOLLOW (files manifest in framing always empty) |

### Behavioral Spot-Checks

Step 7b: SKIPPED for Deep-mode path (byte-identical by design, no server running). The relevant behavioral checks are analytical (CR-01 and CR-02 traced directly from source).

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| skills table has no 'files' column | grep "files" supabase/migrations/017_skills.sql | 'files' only appears in skill_files table DDL | ✗ FAIL — confirms CR-01 |
| skill_snapshot not propagated in sub_ctx | grep "skill_snapshot" backend/app/services/task_service.py | No matches | ✗ FAIL — confirms CR-02 |
| ToolContext.skill_snapshot field exists | grep "skill_snapshot" backend/app/services/tool_dispatcher.py | Field present with default None | ✓ PASS |
| _FakeSkillsDB carries 'files' key real schema lacks | Read test lines 368-370, 392-394 | 'files': ['rubric.md'] present in fake rows | ✗ FAIL — mock-masking confirmed |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WFSKILL-01 | 099-01, 02, 03, 04 | llm_agent/llm_single phase can reference a skill via skill_ref; instructions + files compose into phase framing; read_skill_file auto-whitelisted; skill snapshotted so edit/delete can't break a published workflow; Deep path byte-identical | ✗ BLOCKED (partial) | Instructions composition + Deep byte-identical + kickoff wiring + publish gate are correctly implemented. File manifest is always empty in production (CR-01) and snapshot-routed read is structurally unreachable on the live harness path (CR-02). The 'files compose into phase framing and read_skill_file auto-whitelisted' clause of WFSKILL-01 is broken for the file-content half. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/services/harness/skill_snapshot.py` | 60 | `_SKILL_SELECT` does not include `files` column (which doesn't exist on the table) | Blocker | Materializer always produces empty file manifests in production; Storage copies never happen; read_skill_file snapshot routing always fails with "not in snapshot" |
| `backend/app/services/harness/skill_snapshot.py` | 185 | `filenames = list(row.get("files") or [])` reads nonexistent column | Blocker | Always [] in production; persisted to JSONB and locked by idempotency; can't be fixed retroactively for already-kicked-off definitions without a re-materialization sweep |
| `backend/app/services/task_service.py` | 585-626 | `sub_ctx = ToolContext(...)` missing `skill_snapshot=parent_ctx.skill_snapshot` | Blocker | Snapshot-routing branch in tool_dispatcher.py:479 is dead code on live harness path; D-01 immutability is silently broken (reads track the live skill) |
| `backend/tests/test_099_skill_composition.py` | 368-370, 392-394 | `_FakeSkillsDB` rows carry `'files'` key that real `skills` table doesn't have | Blocker | Mock-masks CR-01 — tests pass because the fake models a schema that doesn't exist in production |
| `backend/tests/test_099_skill_composition.py` | (test_snapshot_routing) | Test injects snapshot directly onto handler ctx, not via the sub-agent dispatch chain | Blocker | Mock-masks CR-02 — test passes because it bypasses the task_service.py sub_ctx construction that would be None in production |

### Human Verification Required

No human verification items — the two critical gaps are analytically verified from source code. All other truths are either fully verified or failed with source-code evidence.

### Gaps Summary

**Two production-breaking defects make the file half of the workflow↔skill composition feature non-functional.** Both are mock-masking failures of exactly the class documented in `feedback_mock_completeness` and the 096-02 `phase_whitelist` wiring fix.

**CR-01 (file manifest always empty):** The materializer in `skill_snapshot.py` reads `row.get("files")` from a `skills` table row, but the `skills` table has no `files` column — files live in the separate `skill_files` table. The correct query (used by the adjacent `_handle_load_skill` in `tool_dispatcher.py:375-381`) is `supabase.table("skill_files").select("filename").eq("skill_id", str(skill_ref))`. As a result: (1) zero Storage copies happen at materialization, (2) the snapshot manifest is always `files: []`, (3) any `read_skill_file` call in a skill-bearing phase always returns "not in the workflow's skill snapshot", and (4) the broken empty manifest is persisted to the `workflow_definitions` JSONB and locked in by the idempotency check — definitions kicked off before a fix can't be auto-healed.

**CR-02 (snapshot-routing branch structurally unreachable):** `_build_phase_tool_context` correctly attaches `skill_snapshot` onto the parent phase ctx. But `run_task_sub_agent` in `task_service.py` rebuilds `sub_ctx = ToolContext(...)` and propagates `phase_whitelist` and `workflow_run_id` but NOT `skill_snapshot`. Every `dispatch_tool` call uses `sub_ctx`, so `sub_ctx.skill_snapshot` is always `None`. The snapshot-routing gate in `tool_dispatcher.py:479` is dead code on the live path. This is structurally identical to the 096-02 `phase_whitelist` wiring fix (the adjacent comment in `task_service.py:612-619` even names the pattern) — but the fix was applied only to `phase_whitelist`, not to the Phase 099 `skill_snapshot`.

**Both bugs are masked by tests that model fake schemas the production database doesn't have.** The fixes are small and targeted (2-3 lines each), consistent with the codebase patterns already established.

---

_Verified: 2026-06-10T04:30:00Z_
_Verifier: Claude (gsd-verifier)_
