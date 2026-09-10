---
phase: 237-one-rule-engine-not-two
plan: 04
subsystem: verification-and-governance
tags: [vis-06, access-fence, agreement, hot-file-ledger, gates, rules-01, rules-02, sc4]
status: complete
requires:
  - Phase 237 Waves 1-3
  - Phase 234 VIS-06 access fence (documents.py accept_classification)
provides:
  - Verification of VIS-06 fence preservation under arrival and classification rule scopes
  - Ingestion agreement test proving suggestion-only rule execution (never auto-move)
  - Hot-file ledger registration of all 8 Phase 237 touched source files with detail narratives
  - Gate clean baseline verification (CLAUDE.md size, ledger, backend unit tests, vitest count gate)
affects:
  - backend/tests/unit/api/test_classification_visibility_fence.py
  - backend/tests/unit/test_ingest_enrich_shared.py
  - docs/HOT-FILE-LEDGER.md
  - CLAUDE.md
key-files:
  modified:
    - backend/tests/unit/api/test_classification_visibility_fence.py
    - backend/tests/unit/test_ingest_enrich_shared.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
metrics:
  tasks_complete: 4 of 4
  backend_unit_rot_set: 71 (ceiling 71, zero headroom)
  backend_unit_passed: 3965 (+19 vs baseline)
  frontend_count_gate: OK (7787 total, 0 failed, 6991 pinned, 238/238 files)
  completed: 2026-09-06
---

# Phase 237 Plan 04: VIS-06 Fence, Agreement Test & Gate Verification — Summary

Wave 4 verified security and architectural invariants, updated project governance ledgers, and validated all mechanical gates across the repository.

## Artifacts Delivered

1. **VIS-06 Access Fence Re-Proof (SC#4)**:
   - `backend/tests/unit/api/test_classification_visibility_fence.py`: Added `test_widened_rule_engine_retains_vis06_classification_refusal` parameterized across `"watch"` and `"classification"` rule scopes.
   - Proved that suggestion of an org-shared destination for a private connection document (`ingest_visibility="private"`):
     - Raises HTTP 403 `classification_refusal` with `requires_confirmation=True` when accepted with `force=False`.
     - Moves document, updates status, and logs audit record with `force=True` when `force=True` is provided.

2. **Ingest Agreement & Anti-Auto-Move Invariant (SC#4)**:
   - `backend/tests/unit/test_ingest_enrich_shared.py`: Added `test_both_paths_produce_only_suggestions_never_auto_move` verifying that across both the legacy `/upload` path and the worker queue path, rules strictly emit `metadata._classification = {"status": "suggested", ...}` and never mutate `folder_id` directly.

3. **Hot-File Ledger (G-5) Sync**:
   - `docs/HOT-FILE-LEDGER.md`: Added scan list rows (disposition <= 200 chars) and detailed narrative sections for all 8 Phase 237 source files (`classification_rules.py`, `classification_rule.py`, `classification_rule_service.py`, `document_view_resolver.py`, `view_filter_compiler.py`, `ClassificationRulesPage.tsx`, `RuleBuilderPanel.tsx`, `ConditionPopover.tsx`).
   - `CLAUDE.md`: Updated G-5 firing files count to `(113 of 224)` and added the 2 firing files at threshold (`classification_rules.py` and `RuleBuilderPanel.tsx`).

## Verification & Mechanical Gates
- `node scripts/check-hot-file-ledger.cjs .planning/237-one-rule-engine-not-two`: Exit 0 (all watched files registered).
- `node scripts/check-claude-md-size.cjs`: Exit 0 (81,332 chars, 68,668 headroom).
- `node scripts/check-backend-unit-baseline.cjs`: Exit 0 (71 failed, 3965 passed, 0 errors; exactly 71 baseline ceiling with +19 new passing tests).
- `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`: Exit 0 (total 7787, 0 failed, 6991 pinned, 238/238 files present).
- `npx vitest run src/components/classification/`: Exit 0 (29/29 passed).
- `npx tsc --noEmit -p tsconfig.app.json`: Clean of any Phase 237 errors.
