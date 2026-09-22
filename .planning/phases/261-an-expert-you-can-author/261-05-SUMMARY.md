# Phase 261-05 Summary: AST Single-Home Fence & End-to-End Scenarios

**Executed**: 2026-09-20
**Status**: COMPLETE
**Requirements**: PACK-07, PACK-08, PACK-09, PACK-10, SEED-303 (S1, S2, S4, S5, S6, S8)

---

## 1. Accomplishments

1. **AST Single-Home Fence for Expert Authoring Permissions (PACK-08)**:
   - Authored `backend/tests/unit/test_261_single_expert_authoring_gate.py`:
     - Asserts that all mutating endpoints (`POST`, `PATCH`, `DELETE`) and access grant management endpoints in `backend/app/api/experts.py` require `require_expert_manage`.
     - Asserts that zero hardcoded role checks (`role == 'org-admin'` or similar) exist across expert API, services, and db layers; permissions are purely data-driven via `role_permissions(role, 'experts:manage')`.
     - Driven RED against a planted hardcoded role check in `backend/app/api/experts.py` (failed with explicit AST violation diagnostic).
     - Restored `backend/app/api/experts.py` to byte-identical state (MD5: `7fa6965b1fa74b805db795eb22c4ab20`).
     - Verified 4/4 passing in 0.74s.

2. **End-to-End Scenario Driver (`backend/tests/unit/test_261_expert_authoring_scenarios.py`)**:
   - Authored scenario driver validating key real-world user flows:
     - **S1 (Authoring CRUD)**: Tenant org-admin creates, fetches, updates, and deletes an expert bundle.
     - **S2 (Permission Denial)**: Caller without `experts:manage` receives structured HTTP 403; granted role succeeds without code changes.
     - **S4 (Union Scope Retrieval)**: Biased mode unifies thread folder subtree with expert knowledge folders.
     - **S5 (Strict Isolation Retrieval)**: Restricted mode scopes retrieval exclusively to expert folders, excluding thread folder.
     - **S6 (Additive Tool Floor)**: Retains deliverable tools (`execute_code`, `workspace_write`, `render_template`, `ask_user`) alongside core tools.
     - **S8 (Clone-on-Customise)**: Immutable system templates refuse modification/deletion by tenants, but clone cleanly into independent tenant bundles.
   - Verified 7/7 scenario tests passing in 0.85s.

3. **Call-Site & Scoping Harmonization Across Test Bed**:
   - Registered `services/expert_authoring.py` as `"NO-RUN"` in `test_256_judge_usage_counted.py`.
   - Updated `test_260_expert_chat_scoping.py` and `test_260_financial_analyzer_conversation.py` to unpack the 4-tuple returned by `_resolve_thread_scoping`.
   - Re-verified all 33 Phase 261 backend tests pass green.

4. **Governance Gates Verification**:
   - `node scripts/check-backend-unit-baseline.cjs`: 71 failed <= 71 ceiling, 5209 passed (+37 passed since Phase 260).
   - `node scripts/vitest-count-gate.cjs`: 297/297 pinned files present, 8487 passed, 0 failing.
   - `node scripts/check-schema-acl-parity.cjs`: 155/155 mirrored statements OK.
   - `node scripts/check-seeds-register.cjs`: 310/310 parsed OK.
   - `node scripts/check-hot-file-ledger.cjs 261`: 316 rows OK.
   - `node scripts/check-claude-md-size.cjs`: 108.9k / 120k chars OK.
   - `npx tsc -p tsconfig.app.json --noEmit`: zero errors in Phase 261 files.

---

## 2. Verification Evidence

- **AST Single-Home Fence (`test_261_single_expert_authoring_gate.py`)**: 4 passed in 0.74s (driven RED against planted check, restored MD5-clean).
- **Scenario Driver (`test_261_expert_authoring_scenarios.py`)**: 7 passed in 0.85s.
- **Total Phase 261 Backend Suites**: 33 passed in 11.66s across 6 test files.
- **Frontend Suites**: 9 passed in 1.42s across `OrgExpertsTab.test.tsx` and `ExpertAuthoringStudio.test.tsx`.
