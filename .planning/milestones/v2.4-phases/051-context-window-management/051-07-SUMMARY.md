---
phase: 051-context-window-management
plan: "07"
subsystem: frontend/model-selector
tags: [model-info, cost-tier, ux, tooltip, frontend]
dependency_graph:
  requires: []
  provides: [costTier field on ModelInfo, cost tier display in model selector]
  affects: [frontend/src/lib/model-info.ts, frontend/src/components/chat/MessageInput.tsx]
tech_stack:
  added: []
  patterns: [static data extension, inline subtitle display]
key_files:
  modified:
    - frontend/src/lib/model-info.ts
    - frontend/src/components/chat/MessageInput.tsx
    - frontend/src/lib/model-info.test.ts
decisions:
  - "Adapted cost tier display to current inline subtitle format (from 051-05) instead of planned TooltipContent"
  - "Added costTier verification tests to model-info.test.ts, fixing pre-existing TS6133 warning"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-24"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 051 Plan 07: Add costTier to ModelInfo and Model Selector Summary

**One-liner:** Added `costTier: 'low' | 'mid' | 'high'` to ModelInfo interface and all 11 model entries, rendering cost tier as an inline label row in the model selector dropdown.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add costTier to ModelInfo interface and all 11 model entries | d84c2c1 | frontend/src/lib/model-info.ts |
| 2 | Render cost tier row in model selector | d9eb347 | frontend/src/components/chat/MessageInput.tsx, frontend/src/lib/model-info.test.ts |

## What Was Built

### Task 1: ModelInfo Interface Extension
- Added `costTier: 'low' | 'mid' | 'high'` to the `ModelInfo` interface in `model-info.ts`
- Added JSDoc comment explaining the tier labels: `/** Relative cost tier: 'low' ($), 'mid' ($$), 'high' ($$$) */`
- Populated all 11 model entries with correct tier values:
  - **high**: gpt-4o, gpt-4.1, claude-sonnet-4-6, claude-opus-4-6, gemini-2.5-pro
  - **mid**: gpt-4.1-mini, gemini-2.5-flash
  - **low**: gpt-4o-mini, gpt-4.1-nano, claude-haiku-4-5-20251001, gemini-2.5-flash-lite

### Task 2: Cost Tier Display in Model Selector
- Added a second subtitle line in the model selector dropdown showing cost tier
- Display format: `Cost tier: Low ($)` / `Mid ($$)` / `High ($$$)` based on `info.costTier`
- Placed below the existing context window / max output / bestFor subtitle line
- Updated `model-info.test.ts` to verify `costTier` field on all 11 model entries

## Deviations from Plan

### Auto-adapted: Inline display instead of TooltipContent

**Rule 1 (adapt to actual code state)**
- **Found during:** Task 2
- **Issue:** The plan expected a `TooltipContent` block at lines 226-230 as the insertion point for the "Cost tier" row. However, Phase 051-05 replaced the Radix tooltip implementation with an inline subtitle approach (`<span className="text-[10px] text-muted-foreground/60">`) — the TooltipContent no longer exists in this form.
- **Fix:** Added cost tier as a second subtitle line inside the existing `{info && (...)}` block, using the same styling pattern as the first subtitle line. This preserves the 051-05 fix while adding the required CTX-04 cost tier data point.
- **Files modified:** frontend/src/components/chat/MessageInput.tsx
- **Commit:** d9eb347

### Auto-fix: Updated model-info.test.ts with costTier assertions

**Rule 2 (missing critical functionality)**
- **Found during:** Task 2
- **Issue:** `model-info.test.ts` imported `ModelInfo` but never used it (pre-existing TS6133 warning). Adding costTier to the interface made it important to test the new field.
- **Fix:** Updated the shape test to verify `costTier` type and valid values; added a dedicated `costTier values` test for all 11 models; used `ModelInfo["costTier"]` type for the valid tiers array (resolving TS6133).
- **Files modified:** frontend/src/lib/model-info.test.ts
- **Commit:** d9eb347

## Verification

```
costTier occurrences in model-info.ts: 12 (1 interface + 11 entries)
Cost tier text in MessageInput.tsx: 1 match
info.costTier references in MessageInput.tsx: 1 occurrence in ternary
All 11 model keys present: confirmed
```

## Known Stubs

None. All 11 model entries have costTier populated with correct values. No placeholder text.

## Threat Flags

None. costTier display is static marketing-tier labels with no sensitive data — per T-051-07-01 in the plan's threat model (accepted risk).

## Self-Check: PASSED

- [x] `frontend/src/lib/model-info.ts` — file exists and has 12 costTier occurrences
- [x] `frontend/src/components/chat/MessageInput.tsx` — file exists and contains "Cost tier:"
- [x] `frontend/src/lib/model-info.test.ts` — file exists and has costTier tests
- [x] Commit d84c2c1 exists (Task 1)
- [x] Commit d9eb347 exists (Task 2)
