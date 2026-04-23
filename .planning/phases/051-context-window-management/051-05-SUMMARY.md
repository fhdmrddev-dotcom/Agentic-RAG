---
plan: 051-05
phase: 051-context-window-management
status: complete
completed: 2026-04-23
executor: inline (orchestrator)
---

# Plan 051-05: Model Info Cards in Chat Model Selector

## What Was Built

Created `model-info.ts` with a static `MODEL_INFO` lookup (11 entries across OpenAI, Anthropic, Google) and updated `MessageInput.tsx` to show an ℹ icon on hover for known models, revealing a tooltip with context window, max output, and best-for label.

## Key Files

### Created
- `frontend/src/lib/model-info.ts` — `ModelInfo` interface + `MODEL_INFO` record with 11 entries keyed by model ID

### Modified
- `frontend/src/components/chat/MessageInput.tsx` — added `Info` to lucide import; added `Tooltip*` from `ui/tooltip` and `MODEL_INFO` imports; wrapped `models.map()` in `TooltipProvider`; added conditional info icon + tooltip for known models with `e.stopPropagation()`

## MODEL_INFO Entries (11 total)

| Provider | Models |
|----------|--------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano |
| Anthropic | claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-5-20251001 |
| Google | gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite |

## Key Design Decisions Honored

- D-11: hover-only info icon (Tooltip, not Popover)
- D-12: no icon for unknown model IDs (graceful degradation — `MODEL_INFO[m]` returns undefined)
- D-13: `MODEL_INFO` is the single source of truth in frontend
- TooltipProvider hoisted above `models.map()` loop (Radix pitfall avoidance)
- `e.stopPropagation()` on Info click prevents accidental model selection

## Verification

- `npx vitest run src/lib/model-info.test.ts` — 7/7 tests passed ✓
- `npm run build` — no new TypeScript errors from modified files ✓

## Commits

- `4becfd9` — feat(051-05): create model-info.ts with MODEL_INFO lookup for 11 models
- `1c70d24` — feat(051-05): add model info icon + tooltip to chat model selector (CTX-04)

## Self-Check: PASSED
