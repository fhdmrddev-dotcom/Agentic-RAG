# Phase 278: deferred items (out of scope, logged rather than fixed)

## From 278-03

- **`node scripts/check-landing-drift.cjs` exits 1, and this is inherited, not caused by the move.** It reports
  `BUILTIN_TOOL_COUNT (tool_dispatcher.py _TOOL_REGISTRY.length)`: source 30, `frontend/src/landing/facts.ts:155` 29.
  The registry has held 30 entries since Phase 273 added `show_artifact`. 278-03 keeps the `_TOOL_REGISTRY`
  literal AST-identical to PHASE_BASE `25b4235c5` (`test_278_registry_pin.py` green), so the script counts 30
  before and after the split. The script still parses the block correctly, which is what 278-03 had to prove;
  only the landing copy is stale. Fix: set `BUILTIN_TOOL_COUNT = 30` and update the `// 29` comment, re-run
  `facts.test.ts`. This is landing-page work (frontend), outside SEAM-03's backend scope.
