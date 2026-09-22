# Phase 261-03 Summary: Runtime Scoping & Additive Tool Floor

**Executed**: 2026-09-20
**Status**: COMPLETE
**Requirements**: PACK-02, PACK-07, BUG-260920-01, SEED-303 (S4, S5, S6), D-v4.3-01, D-v4.3-02

---

## 1. Accomplishments

1. **Additive Tool Floor Preserving Deliverable Tools (`D-v4.3-02` / `SEED-303 S6`)**:
   - Extended `backend/app/services/tool_dispatcher.py` with `EXPERT_DELIVERABLE_TOOLS: frozenset[str]` containing `execute_code`, `workspace_write`, `render_template`, and `ask_user`, protected by module-scope assert against `_TOOL_REGISTRY`.
   - Updated `ResolvedExpertBundle` in `backend/app/services/expert_service.py` to propagate `tool_floor_enabled: bool = True` from database row.
   - Updated `_resolve_thread_scoping` in `backend/app/services/run_producer.py`: when `tool_floor_enabled` is True (default), deliverable tools are preserved alongside core tools and connections.

2. **Union Knowledge Scope Composition (`D-v4.3-01` / `SEED-303 S4`)**:
   - In `_resolve_thread_scoping` (`backend/app/services/run_producer.py`), inspected thread `folder_id` in addition to `active_expert_id`.
   - In default `scope_mode == 'biased'` (Union Scope), unifies the thread's folder subtree and the expert's knowledge folders so existing chat documents and context are preserved.
   - In opt-in `scope_mode == 'restricted'` (Strict Isolation, S5), restricts retrieval exclusively to the expert's knowledge folders.

3. **Synchronized Prompt Scope Elimination of Desync (`BUG-260920-01`)**:
   - Computed `scoped_folder_path` corresponding directly to the effective search scope and passed it into `RunContext`.
   - In `backend/app/services/agent_loop.py`, synchronized `scoped_folder_path = ctx.scoped_folder_path` when provided on `RunContext`.
   - Verified that `agent_loop.py` contains strictly zero `if expert:` branches, satisfying closed-core invariants.

---

## 2. Verification & Test Evidence

- **Unit Tests**:
  - Authored `backend/tests/unit/test_261_expert_runtime_scoping.py`: 4/4 passed (0.31s):
    - `test_union_scope_composition_default_biased` (S4): thread folder + expert folder combined.
    - `test_strict_isolation_restricted_mode` (S5): thread folder excluded, scoped path aligned.
    - `test_additive_tool_floor_preserves_deliverable_tools` (S6): deliverable tools present when enabled, omitted when disabled.
    - `test_agent_loop_contains_zero_expert_branches`: AST inspection confirms zero expert branches in `agent_loop.py`.
  - All 22 Phase 261 backend tests pass (4.21s).
- **Parity & Consistency Gates**:
  - `node scripts/vitest-count-gate.cjs`: 8478 passed, 0 failing, 295/295 pinned OK.
  - `node scripts/check-schema-acl-parity.cjs`: 155/155 mirrored statements OK.
  - `node scripts/check-hot-file-ledger.cjs 261`: 316 rows OK.
  - `node scripts/check-seeds-register.cjs`: 310/310 parsed OK.

---

## 3. Note for Verification (BUS-294 / D-v4.3-03)

Per operator ruling BUS-294 (`D-v4.3-03`), the implementation of `D-v4.3-01` (Union Scope) and `D-v4.3-02` (Additive Tool Floor) is marked for **operator live chat verification** (G-4 lived-experience check in a folder-scoped thread), while structural fences and invariants are verified by automated test suites.
