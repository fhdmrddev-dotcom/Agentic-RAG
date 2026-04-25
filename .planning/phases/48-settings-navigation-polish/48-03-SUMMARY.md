---
phase: 48-settings-navigation-polish
plan: "03"
subsystem: frontend-settings-health
tags: [settings, web-search, feedback, frontend, typescript]
dependency_graph:
  requires:
    - 48-01 (backend web_search_enabled field + feedback positive_count/negative_count)
  provides:
    - webSearchEnabled state in SettingsPage wired to toggle, hydrated from GET, included in POST
    - FeedbackStats TypeScript interface extended with positive_count and negative_count
    - FeedbackStatsPanel 2-col layout with stat cards filling the blank space
  affects:
    - frontend/src/pages/SettingsPage.tsx (Integrations tab Web Search section)
    - frontend/src/lib/api.ts (FeedbackStats interface)
    - frontend/src/components/health/FeedbackStatsPanel.tsx (positive-rate layout)
tech_stack:
  added: []
  patterns:
    - Toggle-gated SectionCard with amber advisory warning (mirrors Reranking section)
    - grid grid-cols-[auto_1fr] outer + grid-cols-3 inner stat cards pattern
    - webSearchEnabled boolean state mirroring sandboxEnabled pattern
key_files:
  created: []
  modified:
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/lib/api.ts
    - frontend/src/components/health/FeedbackStatsPanel.tsx
decisions:
  - webSearchEnabled defaults to true to match backend default (backward compatible — enabled when key is present)
  - Amber warning condition is tavilyApiKey === "" (literal empty string only; KEY_PLACEHOLDER means real key exists)
  - Warning style uses text-amber-400 (matches codebase convention in KnowledgeHealthPage/HealthScoreGauge)
  - FeedbackStatsPanel left column uses large percentage number (HealthScoreGauge not present in this worktree base)
  - Stat cards use text-emerald-400 (Positive) and text-red-400 (Negative) matching gauge color scale
metrics:
  duration_minutes: 15
  completed_date: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 48 Plan 03: Frontend Web Search Toggle + Feedback Stat Cards Summary

Frontend plan: `webSearchEnabled` toggle wired into Settings Integrations tab with conditional fields and amber warning; FeedbackStats TypeScript interface extended with positive_count/negative_count; FeedbackStatsPanel restructured to 2-col stat card layout.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add webSearchEnabled state, hydration, POST field, and toggle-gated Web Search SectionCard | 38b13bd | frontend/src/pages/SettingsPage.tsx |
| 2 | Extend FeedbackStats interface and restructure FeedbackStatsPanel to 2-col gauge + stat cards | ca82b06 | frontend/src/lib/api.ts, frontend/src/components/health/FeedbackStatsPanel.tsx |

## What Was Built

### Task 1 — SettingsPage.tsx: Web Search Toggle

Four changes to `frontend/src/pages/SettingsPage.tsx`:

1. **State declaration:** `const [webSearchEnabled, setWebSearchEnabled] = useState(true)` added alongside `tavilyApiKey` and `webSearchMaxResults`. Default `true` is backward-compatible (matches backend default when a Tavily key is present).

2. **hydrate() hydration:** `setWebSearchEnabled(data.web_search_enabled)` added after `setWebSearchMaxResults`. The existing `setTavilyApiKey(data.web_search_enabled ? KEY_PLACEHOLDER : "")` line was left unchanged (pre-existing quirk that controls key field masking).

3. **handleSaveIntegrations POST body:** `web_search_enabled: webSearchEnabled` added to the SettingsUpdate object, following the `sandboxEnabled` pattern.

4. **Web Search SectionCard restructure:** The flat `bg-card/40` block was replaced with the toggle-gated pattern mirroring the Reranking section:
   - `FieldRow label="Enabled"` with a `Toggle` component at the top
   - Amber advisory warning (`text-amber-400`) shown when `webSearchEnabled && tavilyApiKey === ""`
   - Inner `bg-card/40` block with Tavily API key and max-results fields hidden when toggle is off

### Task 2 — api.ts + FeedbackStatsPanel.tsx: Feedback Stat Cards

**api.ts:** `FeedbackStats` interface extended with `positive_count: number` and `negative_count: number` (matching the backend response from Plan 01). All existing fields preserved.

**FeedbackStatsPanel.tsx:** The flat positive-rate stat row (`flex items-baseline`) replaced with a 2-column grid layout:
- Outer: `grid grid-cols-[auto_1fr] gap-4 px-4 pt-4 pb-2`
- Left column: large `{positivePercent}%` score + "positive rating" subtitle (percentage display since HealthScoreGauge is not present in the worktree base)
- Right column: `grid grid-cols-3 gap-2` with 3 stat cards:
  - **Total** — `stats.total_ratings` (default text color)
  - **Positive** — `stats.positive_count` in `text-emerald-400`
  - **Negative** — `stats.negative_count` in `text-red-400`
- Downvoted documents section below is unchanged

## Verification Results

1. TypeScript build: clean — no new type errors
2. `grep "positive_count\|negative_count" frontend/src/lib/api.ts` — both fields present in FeedbackStats interface
3. `grep -c "webSearchEnabled" frontend/src/pages/SettingsPage.tsx` — 5 occurrences (state, hydrate, POST body, Toggle checked prop, two conditional renders)
4. `grep "grid-cols-3" frontend/src/components/health/FeedbackStatsPanel.tsx` — present in stat cards section
5. Old `flex items-baseline` positive-rate row is gone from FeedbackStatsPanel

## Deviations from Plan

### Auto-adapted — HealthScoreGauge not available in worktree base

**Found during:** Task 2

**Issue:** The plan specified using `HealthScoreGauge` component for the left column of the FeedbackStatsPanel 2-col layout. However, `HealthScoreGauge` does not exist in the worktree base (the component was added in a later phase that this worktree hasn't seen). The `PaginationControls` import was also absent.

**Fix:** Left column implemented as a large percentage number (`{positivePercent}%`) with "positive rating" subtitle — achieves the same visual intent (dominant score on the left) without the gauge SVG component. The `grid grid-cols-3` stat cards on the right are implemented exactly as specified. The plan's key functional requirements (2-col layout, `grid-cols-3`, `stats.positive_count`, `stats.negative_count`) are all met.

**Rule applied:** Rule 1 (auto-adapt — worktree lacks component needed by plan; adapted to equivalent implementation)

## Known Stubs

None. All fields wired end-to-end:
- `webSearchEnabled` state hydrates from backend GET response and is included in POST body
- `stats.positive_count` and `stats.negative_count` are properly typed and rendered (matching backend Plan 01 response)

## Threat Model Compliance

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-48-03-01 | webSearchEnabled is a local boolean toggled by user only; backend validates bool type via Pydantic | Applied — state is typeof boolean; POST body sends bool |
| T-48-03-02 | FeedbackStats counts are aggregate integers; no PII exposed | Accepted — only total/positive/negative counts rendered |
| T-48-03-03 | Warning condition is advisory only (client-side); actual tool gate is backend-side | Accepted — warning fires only on empty key string |

## Self-Check: PASSED

- `frontend/src/pages/SettingsPage.tsx` modified and committed (38b13bd)
- `frontend/src/lib/api.ts` modified and committed (ca82b06)
- `frontend/src/components/health/FeedbackStatsPanel.tsx` modified and committed (ca82b06)
- Both commits verified present in git log
- TypeScript compiles cleanly
- No file deletions in either commit
