---
phase: 48-settings-navigation-polish
plan: "02"
subsystem: frontend/ui
tags: [nav, tabs, animation, css, visual-regression]
dependency_graph:
  requires: []
  provides:
    - NavPanel logo always-visible icon on collapse (NAV-01, NAV-02)
    - Tab selection color-only animation (all Tabs instances)
  affects:
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/components/ui/tabs.tsx
tech_stack:
  added: []
  patterns:
    - opacity toggled on text span only (icon always visible)
    - transition-colors instead of transition-all for tab activation
key_files:
  created: []
  modified:
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/components/ui/tabs.tsx
decisions:
  - Move opacity/transition classes from logo container div to text span only — icon div never opacity-toggled
  - Global TabsTrigger transition-all → transition-colors — no tab in this app needs transition-all behavior
metrics:
  duration: "~5 minutes"
  completed: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  files_created: 0
requirements:
  - NAV-01
  - NAV-02
---

# Phase 48 Plan 02: Frontend Visual Fixes Summary

**One-liner:** NavPanel Sparkles icon kept always visible on collapse by moving opacity toggling from the container div to the text span only; TabsTrigger stale animation eliminated by replacing `transition-all` with `transition-colors`.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Fix NavPanel logo — icon always visible, text opacity-toggled on collapse | `8786192` | `frontend/src/components/layout/NavPanel.tsx` |
| 2 | Fix stale tab animation — replace transition-all with transition-colors in TabsTrigger | `e26115e` | `frontend/src/components/ui/tabs.tsx` |

## What Was Built

### Task 1: NavPanel Logo Visibility Fix

**Problem:** The entire logo group (Sparkles icon + "Agentic RAG" text) was wrapped in a single `<div>` with `transition-opacity` and `isCollapsed ? "opacity-0" : "opacity-100 delay-100"`. This caused both the icon and the text to disappear when the sidebar collapsed.

**Fix:** Moved the opacity transition classes from the container div to the text `<span>` only. The container div is now a plain `className="flex items-center gap-2"`. The Sparkles icon div is unchanged with `shrink-0` and all gradient classes intact — it is always visible regardless of collapse state.

**Pattern:** Mirrors the established nav item button pattern (NavPanel.tsx lines 269-273) where `<Icon>` never gets opacity classes and only the `<span>` label is opacity-toggled.

### Task 2: TabsTrigger Animation Fix

**Problem:** `TabsTrigger` used `transition-all` which animates ALL CSS properties on tab activation — including `box-shadow`, `transform`, and positional properties. The `data-[state=active]:shadow-sm` class toggling through `transition-all` caused a visible "shaking" animation on the Stale tab (and any tab gaining a shadow on activation).

**Fix:** Single token replacement — `transition-all` → `transition-colors` in the `TabsTrigger` className string at line 30. Only color-related properties (color, background-color, border-color, text-decoration-color, fill, stroke) now animate on tab activation.

**Scope:** Global change affecting all `<Tabs>` instances in the app: Settings page tabs, Library Health tabs, Low Confidence sub-tabs. This is intentional and correct.

## Verification Results

| Check | Result |
|-------|--------|
| `opacity-0`/`opacity-100` on span (not container div) | PASS — lines 247, not on container |
| Container div is plain `flex items-center gap-2` | PASS — line 241 |
| No `transition-all` in tabs.tsx | PASS — grep returns no matches |
| `transition-colors` in TabsTrigger className | PASS — line 30 exactly one match |
| Sparkles icon div still has `shrink-0` and gradient classes | PASS — unchanged |
| TypeScript compilation | PASS — no new errors |

## Deviations from Plan

None — plan executed exactly as written. Both tasks were straightforward single-location edits matching the specified before/after patterns.

## Known Stubs

None. These are pure CSS/className changes with no data flows.

## Threat Flags

None. Pure client-side rendering changes with no data flows, no network endpoints, no auth paths. Both threat register entries (T-48-02-01, T-48-02-02) are accept disposition — no mitigations required.

## Self-Check

- [x] `frontend/src/components/layout/NavPanel.tsx` exists and contains `transition-opacity` on the span
- [x] `frontend/src/components/ui/tabs.tsx` exists and contains `transition-colors` (not `transition-all`)
- [x] Commit `8786192` exists — NavPanel logo fix
- [x] Commit `e26115e` exists — TabsTrigger animation fix
- [x] TypeScript compilation passes with no new errors

## Self-Check: PASSED
