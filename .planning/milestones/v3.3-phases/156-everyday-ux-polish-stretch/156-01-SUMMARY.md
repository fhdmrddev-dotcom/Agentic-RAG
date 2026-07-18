---
phase: 156-everyday-ux-polish-stretch
plan: 01
subsystem: ui
tags: [react, vitest, typescript, threads, date-grouping, xss, nyquist, tdd-scaffold]

# Dependency graph
requires:
  - phase: 155-accessibility-sweep-wcag-aa
    provides: the A11Y-01 row-a11y bar (real <button> rows, group-focus-within CSS-gated action reveal) the Wave-1 column MOVE must preserve
provides:
  - "frontend/src/lib/threadGroups.tsx — the ONE shared pure engine (date bucketing + title-filter predicate + safe match-highlight) the chat-history column, ⌘K palette, and mobile search all consume"
  - "The T-156-01 XSS control (HighlightTitle: <mark> JSX text nodes, never dangerouslySetInnerHTML) built + unit-proven before any user-controlled title is rendered"
  - "Four green it.todo component-test contracts (NavPanel / ChatHistoryColumn / ChatHistoryColumn.a11y / ThreadCommandPalette) — Nyquist verify targets for Waves 1-2"
affects: [156-02 (rail + ChatHistoryColumn), 156-03 (⌘K ThreadCommandPalette), 156-04 (mobile drawer search)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared pure engine module (threadGroups) — one tested predicate reused by column + palette + mobile, so behavior can't drift"
    - "Calendar-day-aware date bucketing via a local startOfDay (not raw 24h) + defensive within-bucket updated_at DESC sort"
    - "Safe match-highlight as JSX text nodes (React auto-escapes) — the sketch's innerHTML highlight is deliberately NOT ported (XSS)"
    - "Wave-0 it.todo test scaffolds naming every downstream assertion (Nyquist) — no Wave-1/2 task ships without an automated verify target"

key-files:
  created:
    - frontend/src/lib/threadGroups.tsx
    - frontend/src/lib/__tests__/threadGroups.test.tsx
    - frontend/src/components/layout/__tests__/NavPanel.test.tsx
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.test.tsx
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.a11y.test.tsx
    - frontend/src/components/layout/__tests__/ThreadCommandPalette.test.tsx
  modified: []

key-decisions:
  - "Shipped threadGroups as .tsx (not the planned .ts) — it exports a JSX HighlightTitle component and its test renders JSX; tsc only parses JSX in .tsx. Downstream imports the extensionless @/lib/threadGroups (Rule 3)."
  - "POLISH-01 stays OPEN — Wave 0 ships no user-visible UI (the 3 SCs land in Wave 1 + Wave 2); requirements.mark-complete deliberately NOT called (148-155 false-green-avoidance convention)."
  - "Source-level XSS guard via a Vite `?raw` import in the unit test (cwd-independent) instead of node:fs (import.meta.url is not a file: URL under vitest)."

patterns-established:
  - "threadGroups engine: bucketFor / groupByDate / matchesTitle / folderLabel / HighlightTitle / DateBucket"
  - "it.todo Wave-0 contract: import only { describe, it } from vitest, never the not-yet-built component, so files collect green as pending todos"

requirements-completed: []  # POLISH-01 is phase-spanning — intentionally NOT marked (Wave 0 delivers no SC). See Decisions.

# Metrics
duration: 12min
completed: 2026-07-16
---

# Phase 156 Plan 01: Wave 0 — Shared threadGroups Engine + Test Scaffolds Summary

**The one shared date-bucketing + title-filter + XSS-safe match-highlight engine (`threadGroups.tsx`), fully unit-tested including an `<img onerror>` inert-text proof, plus four green `it.todo` component-test contracts that name every Wave-1/2 assertion.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-16T16:09:14Z
- **Completed:** 2026-07-16T16:22:00Z
- **Tasks:** 2
- **Files created:** 6 (0 modified)

## Accomplishments
- **`threadGroups.tsx`** — the single pure module every later wave transforms `threads` through: `bucketFor`/`groupByDate` (Today / Yesterday / Last 7 days / Last 30 days / Older, empty buckets folded, within-bucket `updated_at` DESC), the shared `matchesTitle` substring predicate, `folderLabel` (name / "Unfiled" / "Folder"), and `HighlightTitle`.
- **The T-156-01 XSS control is built and proven HERE** — `HighlightTitle` renders the matched slice inside a `<mark>` as JSX text nodes; `dangerouslySetInnerHTML` appears **zero** times in the module; a title of `<img src=x onerror=alert(1)>` renders as inert visible text (no `<img>` element).
- **Four green `it.todo` contracts** under `components/layout/__tests__/` (NavPanel, ChatHistoryColumn, ChatHistoryColumn.a11y, ThreadCommandPalette) enumerate every SC#1 / SC#2 / SC#3 + D-07 / D-09 / A11Y-01 assertion Waves 1-2 must implement — 36 todos, 0 failures, no imports of the not-yet-built components.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build threadGroups engine + unit test** — `8a875603` (feat)
2. **Task 2: Scaffold four component test contracts** — `8b6eb0a0` (test)

**Plan metadata:** `<this commit>` (docs: complete plan)

## Files Created/Modified
- `frontend/src/lib/threadGroups.tsx` — shared date-bucketing + title-filter + safe-highlight engine (exports `bucketFor`, `groupByDate`, `matchesTitle`, `HighlightTitle`, `folderLabel`, `DateBucket`)
- `frontend/src/lib/__tests__/threadGroups.test.tsx` — 14 tests: bucket boundaries, empty-fold, within-bucket DESC, filter case-insensitivity + blank-passthrough, folderLabel branches, the `<img onerror>` XSS-inert proof, and a `?raw` source guard (no `dangerouslySetInnerHTML`, `<mark` present)
- `frontend/src/components/layout/__tests__/NavPanel.test.tsx` — SC#1 New-Chat reachability + D-07 rail/shield/no-collapse `it.todo` contract
- `frontend/src/components/layout/__tests__/ChatHistoryColumn.test.tsx` — SC#2 inline filter/highlight/empty + SC#3 date groups + D-09 preserved-row `it.todo` contract
- `frontend/src/components/layout/__tests__/ChatHistoryColumn.a11y.test.tsx` — A11Y-01 axe + real `<button>` rows + `group-focus-within` CSS-gated actions `it.todo` contract
- `frontend/src/components/layout/__tests__/ThreadCommandPalette.test.tsx` — SC#2 ⌘K open/filter/roving/Esc + dialog/listbox roles + no-cmdk `it.todo` contract

## Decisions Made
- **`.tsx`, not `.ts`, for the engine + its test** (see Deviations — Rule 3). One shared module keeps all six exports together with a literal JSX `<mark>` and clean `tsc`.
- **POLISH-01 left OPEN.** Wave 0 delivers no user-visible UI — the three ROADMAP SCs (New Chat reachable / search / date grouping) land in Wave 1 (rail + `ChatHistoryColumn`) and Wave 2 (⌘K). Marking POLISH-01 complete now would be a false-green; per the 148-155 convention `requirements.mark-complete` was deliberately NOT called.
- **`cmdk` is NOT introduced** (research-resolved): the ⌘K palette is hand-rolled on the existing Radix `ui/dialog.tsx`, so no `checkpoint:human-verify` install gate and no supply-chain surface change (T-156-SC). The scaffold locks a "no cmdk import" todo.
- **Source-level XSS guard via Vite `?raw`** — `import.meta.url` is not a `file:` URL under vitest, so `node:fs`+`fileURLToPath` throws; the `?raw` import inlines the module source (typed by `vite/client`) cwd-independently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking build] Engine + test shipped as `.tsx` instead of the planned `.ts`**
- **Found during:** Task 1 (Build threadGroups)
- **Issue:** The plan named `frontend/src/lib/threadGroups.ts` + `…/__tests__/threadGroups.test.ts`, but the module exports a JSX `HighlightTitle` component (literal `<mark>…</mark>`) and the unit test renders `<HighlightTitle/>`. TypeScript's `tsc` only parses JSX in `.tsx` files — a `.ts` extension produces net-new parse/type errors (verified: zero `.ts` files in this repo carry JSX). That directly violates the "0 net-new tsc errors" bar.
- **Fix:** Created both files as `.tsx`. Downstream code imports the extensionless `@/lib/threadGroups`, so module resolution is unaffected. Also reworded one source comment so the exact token `dangerouslySetInnerHTML` never appears in the module (honors the `grep -c … == 0` acceptance, which counts comments).
- **Files modified:** frontend/src/lib/threadGroups.tsx, frontend/src/lib/__tests__/threadGroups.test.tsx (both created at `.tsx`)
- **Verification:** `npx vitest run` → 14/14 green; `grep -c dangerouslySetInnerHTML threadGroups.tsx` → 0; `<mark` present (3×); `npx tsc -b` → exactly 30 pre-existing baseline errors, 0 referencing the new files.
- **Committed in:** `8a875603` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking-build)
**Impact on plan:** Extension-only correction so the JSX-bearing engine and its test compile under `tsc`. All exports, behaviors, the `<mark>` highlight, and the XSS guard are exactly as specified; no scope change. Downstream import path (`@/lib/threadGroups`) is unchanged.

## Issues Encountered
- **`import.meta.url` is not a `file:` URL under vitest** — the first source-guard implementation (`node:fs` + `fileURLToPath`) threw "The URL must be of scheme file". Switched to a Vite `?raw` import of the module source (typed by `vite/client`), which is cwd-independent and idiomatic. Resolved within Task 1 before commit.

## User Setup Required
None — frontend-only, no external service configuration, no migration, no new dependency, no cloud parity.

## Next Phase Readiness
- **Wave 1 (156-02)** can build the permanent rail + `ChatHistoryColumn` against a tested engine (`groupByDate`/`matchesTitle`/`folderLabel`/`HighlightTitle`) and a green `it.todo` contract to fill in — replace each todo in `NavPanel.test.tsx` / `ChatHistoryColumn.test.tsx` / `ChatHistoryColumn.a11y.test.tsx` with a live render test.
- **Wave 2 (156-03)** consumes the SAME `matchesTitle` + `groupByDate` for the ⌘K palette (`ThreadCommandPalette.test.tsx` contract), hand-rolled on Radix `ui/dialog.tsx` — no `cmdk`.
- **Reminder for Wave 1:** move the `loadThreads()` bootstrap up to `ChatLayout` (not into the chat-only column) so the global ⌘K isn't empty on non-chat views (RESEARCH Pitfall 1); keep the filename `NavPanel.tsx` (a test mocks `"../NavPanel"`); keep the operator shield OUTSIDE `NAV_ITEMS` (D-07 lock).
- No blockers.

## Self-Check: PASSED
- Files verified present: `frontend/src/lib/threadGroups.tsx`, `frontend/src/lib/__tests__/threadGroups.test.tsx`, `frontend/src/components/layout/__tests__/{NavPanel,ChatHistoryColumn,ChatHistoryColumn.a11y,ThreadCommandPalette}.test.tsx` — all FOUND.
- Commits verified in `git log`: `8a875603` (Task 1), `8b6eb0a0` (Task 2) — both FOUND.
- Gates re-run green: threadGroups 14/14 pass; four scaffolds 36 todo / 0 failures; `tsc -b` 30 baseline / 0 net-new.

---
*Phase: 156-everyday-ux-polish-stretch*
*Completed: 2026-07-16*
