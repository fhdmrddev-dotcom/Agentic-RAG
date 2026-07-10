# Phase 122 — Deferred Items (out-of-scope discoveries)

Out-of-scope failures/issues found during execution. NOT fixed (SCOPE BOUNDARY rule —
only auto-fix issues directly caused by the current task's changes).

## 122-04 (TDP-01)

- **Pre-existing frontend test failure: `model-info.test.ts` `costTier` assertion.**
  `MODEL_INFO["gpt-4o"]?.costTier` expects `"high"` but receives `"mid"`
  (`frontend/src/lib/model-info.test.ts:57`). The model registry was re-curated
  (Phase 096 D-05 model curation), so the cost-tier data drifted from the test's
  expectation. UNRELATED to Plan 04: `model-info.test.ts` does not import
  `workspacePanel.ts`, and `model-info.ts` is untouched by this plan. The
  `humanize` export (the only Plan-04 frontend source change) introduces no
  type errors and does not affect this file. Out of scope — left for a
  model-registry data-sync fix. Found during Task 2.
