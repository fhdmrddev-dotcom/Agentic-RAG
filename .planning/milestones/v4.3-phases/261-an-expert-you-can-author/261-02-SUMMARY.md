# Phase 261-02 Summary: Ephemeral AI Drafting & Non-Ingestion Guarantee

**Executed**: 2026-09-20
**Status**: COMPLETE
**Requirements**: PACK-09, PACK-01 closed-core inventory

---

## 1. Accomplishments

1. **`ExpertDraftOutput` Schema & Forced Emission**:
   - Implemented `backend/app/services/expert_authoring.py` defining Pydantic model `ExpertDraftOutput` matching the full presentation and scoping contract of an Expert.
   - Wired `generate_expert_draft` using `app.services.forced_emit.forced_emit` and function calling tools (`_emit_tool`) without introducing any new phase type executors or autonomous loops.
   - Implemented `_generate_fallback_draft` providing deterministic fallback grounding using regex-based keyword and stem extraction across user descriptions and uploaded brainstorm notes.

2. **Ephemeral Brainstorming Non-Ingestion Guarantee (`PACK-09`)**:
   - Added `POST /experts/draft` route in `backend/app/api/experts.py` secured with `require_expert_manage`.
   - Uploaded brainstorming files are read in-memory (`await f.read()`), decoded with length bounds (30,000 characters), and immediately garbage collected without writing to disk or persisting to `public.documents` or `public.document_chunks`.
   - Dynamically pulls available folders, enabled skills, and active connections within caller's organization to provide real grounding context for the draft synthesizer.

3. **Closed-Core Inventory Fence Verification**:
   - Created `backend/tests/unit/test_261_closed_core_inventory.py` asserting exact frozen counts matching baseline `f3a1fe66f`:
     - `PHASE_TYPE_REGISTRY_ENTRIES`: strictly 7 executors (0 expert executors).
     - `EMITTER_REGISTRY`: strictly 1 emitter (0 expert emitters).
     - `_TOOL_REGISTRY`: strictly 29 tools (0 expert tools/dispatchers).
     - `EXPERT_CORE_TOOLS`: strictly 10 core tools, strict subset of `_TOOL_REGISTRY`.
     - `expert_authoring.py`: verified AST check ensuring `forced_emit` usage and strictly 0 while loops.

4. **Vocabulary Fix (BUS-293)**:
   - Renamed grant-axis visibility from `restricted` to `granted` across all 10 sites, cleanly separating the Grant axis (`granted`) from the Knowledge scope axis (`restricted`).

---

## 2. Verification & Test Evidence

- **Unit Tests**:
  - `backend/tests/unit/test_261_expert_authoring.py`: 4/4 passed (heuristics, grounding, forced_emit, non-ingestion DB verification).
  - `backend/tests/unit/test_261_closed_core_inventory.py`: 5/5 passed (exact frozen counts and closed-core invariants).
  - `backend/tests/unit/test_261_expert_grants_db.py`: 9/9 passed.
  - Total 261 backend tests: 18/18 passed in 3.01s.
- **Parity & Consistency Gates**:
  - `node scripts/check-schema-acl-parity.cjs`: 155/155 mirrored statements OK.
  - `node scripts/check-hot-file-ledger.cjs 261`: 316 rows, all watched files OK.
  - `node scripts/check-seeds-register.cjs`: 310/310 parsed OK.
  - `node scripts/check-claude-md-size.cjs`: 108,921 chars (72.6% limit OK).

---

## 3. Deviations & Corrections

- **`connector_connections` Query**: Fixed column selection in `backend/app/api/experts.py` from non-existent `slug, service_name` to valid `id, name, capability, service_id`.
- **Vocabulary Alignment**: Fully resolved BUS-293 `restricted` -> `granted` rename on visibility before completing plan.
