---
phase: 237-one-rule-engine-not-two
plan: 03
subsystem: classification-ui
tags: [frontend, rule-builder, condition-popover, scope-selector, sc1, sc3, rules-01]
status: complete
requires:
  - Phase 118 RuleBuilderPanel & ClassificationRulesPage
  - Phase 237 Wave 1 backend scope endpoints
provides:
  - Scope selector segmented control ('When files arrive' vs 'After extraction') in RuleBuilderPanel
  - Condition field restriction to WATCH_FIELDS in ConditionPopover when scope is 'watch'
  - Pruning/warning on scope switch from classification to watch
  - Scope filter chips ('All', 'Arrival', 'Extracted') and badges in ClassificationRulesPage
affects:
  - frontend/src/types/index.ts
  - frontend/src/lib/api/knowledge.ts
  - frontend/src/components/classification/RuleBuilderPanel.tsx
  - frontend/src/components/classification/ClassificationRulesPage.tsx
  - frontend/src/components/ingestion/ConditionPopover.tsx
  - frontend/src/components/ingestion/AutomationGroup.tsx
key-files:
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api/knowledge.ts
    - frontend/src/components/classification/RuleBuilderPanel.tsx
    - frontend/src/components/classification/ClassificationRulesPage.tsx
    - frontend/src/components/ingestion/ConditionPopover.tsx
    - frontend/src/components/ingestion/AutomationGroup.tsx
    - frontend/src/components/classification/RuleBuilderPanel.test.tsx
    - frontend/src/components/classification/ClassificationRulesPage.test.tsx
metrics:
  tasks_complete: 3 of 3
  completed: 2026-09-06
---

# Phase 237 Plan 03: Frontend RuleBuilderPanel & ClassificationRulesPage — Summary

Wave 3 delivered the unified rule builder experience in the UI (RULES-01 / SC#1), enabling users to configure either arrival watch rules or post-extraction classification rules with the same condition builder controls while guarding against SC#3 invalid field configurations.

## Artifacts Delivered

1. **Types & API Client**:
   - `frontend/src/types/index.ts`: Added `rule_scope?: "watch" | "classification"` to `ClassificationRule`.
   - `frontend/src/lib/api/knowledge.ts`: Threaded `rule_scope` into `createRule` and `updateRule` payloads.

2. **Unified RuleBuilderPanel & ConditionPopover**:
   - `frontend/src/components/ingestion/ConditionPopover.tsx`: Added `ruleScope?: "watch" | "classification"` prop; when `ruleScope === "watch"`, restricts selectable fields exclusively to `WATCH_FIELDS` (`name`, `path`, `mime`, `size`, `source_system`, `source_connection_id`).
   - `frontend/src/components/classification/RuleBuilderPanel.tsx`: Added Scope selector segmented control (`When files arrive (Watch)` vs `After extraction (Classification)`). Switching to watch scope automatically warns and strips conditions referencing un-extracted fields to prevent SC#3 HTTP 422 refusal errors. Passes `ruleScope` to `ConditionPopover`, `createRule`, and `updateRule`.

3. **ClassificationRulesPage & AutomationGroup**:
   - `frontend/src/components/classification/ClassificationRulesPage.tsx`: Added scope filter chips (`All`, `Arrival`, `Extracted`) and filtered rule listings accordingly.
   - `frontend/src/components/ingestion/AutomationGroup.tsx`: Rendered visual scope indicator badges (`Arrival` vs `Extracted`) using `data-testid="rule-scope-badge"`.

## Verification
- `npx vitest run src/components/classification/`: 29/29 tests passed across all 3 test files (`RuleBuilderPanel.test.tsx`, `ClassificationRulesPage.test.tsx`, `ClassificationSection.test.tsx`).
- `npx tsc --noEmit -p tsconfig.app.json`: Passed clean on all touched files with zero new errors.
