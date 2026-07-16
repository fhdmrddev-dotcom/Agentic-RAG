---
phase: 156-everyday-ux-polish-stretch
plan: 02
subsystem: ui
tags: [react, vitest, typescript, refactor, navigation, information-architecture, threads, a11y, xss]

# Dependency graph
requires:
  - phase: 156-01
    provides: "the shared @/lib/threadGroups engine (groupByDate / matchesTitle / folderLabel / HighlightTitle) + the four it.todo component-test contracts this wave fills in"
  - phase: 155-accessibility-sweep-wcag-aa
    provides: "the A11Y-01 row-a11y bar (real <button> rows, group-focus-within CSS-gated action reveal) the column MOVE preserves verbatim"
provides:
  - "frontend/src/components/layout/ChatHistoryColumn.tsx — the dedicated full-height chat-history column (lifted rows + inline title filter + date grouping + folder chip); satisfies SC#2 (inline tier) + SC#3"
  - "frontend/src/components/layout/NavPanel.tsx repurposed into a permanent ~58px icon rail (New Chat reachable on every view — SC#1; collapse machinery removed; stream-free; operator shield probe-gated OUTSIDE navItems — D-07)"
  - "frontend/src/components/layout/ChatLayout.tsx composition — rail + chat-only ChatHistoryColumn + the app-wide loadThreads bootstrap lifted up (so the Wave-2 ⌘K palette is never empty on non-chat views)"
affects: [156-03 (⌘K ThreadCommandPalette — consumes the same engine + the onOpenPalette seam left here), 156-04 (mobile drawer search)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IA split: one collapsible NavPanel → a permanent thin icon rail + a dedicated ChatHistoryColumn, composed in ChatLayout — nav growth is decoupled from history for good (D-01/D-10)"
    - "MOVE + wrap (D-09): renderThreadList() lifted VERBATIM into the column (rows/rename/delete/SEED-064 dot+Stop/options/A11Y-01 reveal) — search + date groups wrap AROUND the preserved logic, rows are not restyled"
    - "App-wide single-source thread bootstrap: loadThreads() effect lifted UP to the always-mounted ChatLayout (not the chat-only column) so every surface shares one list (RESEARCH Pitfall 1)"
    - "XSS-safe highlight reused (T-156-01): titles/filter-highlights render via HighlightTitle JSX text nodes — zero dangerouslySetInnerHTML"

key-files:
  created:
    - frontend/src/components/layout/ChatHistoryColumn.tsx
  modified:
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.test.tsx
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.a11y.test.tsx
    - frontend/src/components/layout/__tests__/NavPanel.test.tsx

key-decisions:
  - "POLISH-01 stays OPEN — the 3 SCs are code-complete at the inline tier here, but the plan author's model is 'SC#2 lands across Wave 1 + Wave 2' (inline filter + ⌘K), mobile parity is Wave 4, and the SC-defining 'rail stops starving history' proof requires live Chrome-MCP UAT (jsdom can't). Per the 148-155 false-green-avoidance convention + the D-10 'flips only when verifiably relieved' precedent, requirements.mark-complete was deliberately NOT called."
  - "Rail nav/New/shield/theme/sign-out buttons gained explicit aria-labels (icon-only now) — the tooltip is visual, aria-label is the accessible name (A11Y-01 do-no-harm + testability)."
  - "Folder chip renders the folder NAME (folderLabel) replacing the bare FolderIcon; title span became flex-1 min-w-0 truncate so a long title still ellipsizes with the chip visible (minimal, sketch-078 .r-title/.r-meta parity — within D-09)."
  - "onOpenPalette?: () => void left as an optional seam on ChatHistoryColumn Props + a `{/* ⌘K chip added in Wave 2 */}` comment — no onClick wired to a non-existent overlay."

requirements-completed: []  # POLISH-01 phase-spanning — intentionally NOT marked (see Decisions). Waves 2-4 + live UAT remain.

# Metrics
duration: 17min
completed: 2026-07-16
---

# Phase 156 Plan 02: Wave 1 — Permanent Icon Rail + ChatHistoryColumn + ChatLayout Composition Summary

**The single collapsible NavPanel is split into a permanent ~58px icon rail (New Chat reachable on every view — SC#1) and a new dedicated full-height `ChatHistoryColumn` that owns the thread list with an inline "Filter this list…" box (SC#2 inline) and Today/Yesterday/…/Older date grouping (SC#3), composed in `ChatLayout` with the `loadThreads` bootstrap lifted app-wide — a MOVE-not-rewrite that preserves every A11Y-01 / SEED-064 row behavior and structurally relieves the BUG-260711-01 crowding (D-10).**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-07-16T16:29:01Z
- **Completed:** 2026-07-16T16:46:23Z
- **Tasks:** 3
- **Files created:** 1 · **Files modified:** 5

## Accomplishments
- **`ChatHistoryColumn.tsx` (new, 394 lines)** — the entire `NavPanel.renderThreadList()` row body lifted VERBATIM (D-09): select / inline rename / delete-confirm `AlertDialog` / the SEED-064 resting running dot + Stop + `ActiveRunsTray` / the per-thread options menu / the Phase-155 A11Y-01 `group-focus-within` CSS-gated action reveal (never render-gated). Wrapped with an `<h2>Chats</h2>` header + New (+) + folder-scope picker, a controlled **"Filter this list…"** input (SC#2 — `matchesTitle`, XSS-safe `HighlightTitle`, honest empty-state), and **date grouping** via `groupByDate` with per-bucket mono count pills and empty buckets folded (SC#3). Each row carries a folder chip (name or italic "Unfiled") via `folderLabel`. `w-[300px]` full-height column, `hidden md:flex`.
- **`NavPanel.tsx` repurposed into the permanent 58px icon rail** — deleted the collapse machinery (the persisted collapse flag + toggle state, the w-64/w-16 masking + toggle button, the unused `Button`/`PanelLeftClose`/`PanelLeftOpen` imports — clearing the `NavPanel.tsx:3` baseline TS6133), deleted the whole thread region (moved to the column) and the `loadThreads` bootstrap (moved to ChatLayout). Rebuilt as logo + a **New Chat (+) reachable on every view (SC#1/D-02)** + tooltip-wrapped nav icons + footer (theme / **probe-gated operator shield OUTSIDE `navItems`** — D-07 / sign out). Props shrunk to the 8 rail-only fields; the rail is now **stream-free** (no StreamsProvider dependency); filename + `NavPanel` export kept (a test mocks `"../NavPanel"`).
- **`ChatLayout.tsx` composition** — lifted the `loadThreads().catch(…2s retry)` bootstrap UP to the always-mounted root (RESEARCH Pitfall 1), shrank the `<NavPanel>` call site to the 8 props, and mounts `<ChatHistoryColumn>` between the rail and the chat grid **only when `activeView === "chat"`**. Rail + column are `shrink-0`; the chat grid stays `flex-1 min-w-0` → three desktop columns, zero horizontal overflow (Pitfall 7).
- **Tests:** replaced the three Wave-0 `it.todo` scaffolds with **32 live tests** (13 ChatHistoryColumn behavior + 6 a11y + 9 NavPanel + the 2 nav-items D-07 lock, all green); `ChatLayoutLaunch.test.tsx` re-run green.

## Task Commits

Each task was committed atomically:

1. **Task 1: ChatHistoryColumn — lifted rows + inline filter + date groups** — `eac27be4` (feat)
2. **Task 2: NavPanel → permanent 58px icon rail** — `62d07fe8` (feat)
3. **Task 3: ChatLayout composition + lifted loadThreads bootstrap** — `ca38e4da` (feat)

**Plan metadata:** `<this commit>` (docs: complete plan)

## Files Created/Modified
- `frontend/src/components/layout/ChatHistoryColumn.tsx` (created) — the dedicated chat-history column (lifted rows + inline filter + date groups + folder chip)
- `frontend/src/components/layout/NavPanel.tsx` (modified) — repurposed into the permanent 58px icon rail
- `frontend/src/components/layout/ChatLayout.tsx` (modified) — composes rail + chat-only column, owns the lifted loadThreads bootstrap
- `frontend/src/components/layout/__tests__/ChatHistoryColumn.test.tsx` (modified) — 13 live SC#2/SC#3/D-09 tests (StreamsProvider mocked)
- `frontend/src/components/layout/__tests__/ChatHistoryColumn.a11y.test.tsx` (modified) — 6 live vitest-axe + button-structure tests
- `frontend/src/components/layout/__tests__/NavPanel.test.tsx` (modified) — 9 live rail tests (renders sans StreamsProvider)

## Decisions Made
- **POLISH-01 left OPEN.** The three SCs are now code-complete at the inline tier, but (a) the plan's own model is "SC#2 lands across Wave 1 + Wave 2" (inline filter + the ⌘K global finder), (b) mobile parity is Wave 4, and (c) the SC-defining "the rail actually stops starving history" claim is only verifiable with live Chrome-MCP UAT (jsdom has no layout). Per the 148-155 false-green-avoidance convention and the D-10 precedent (BUG-260711-01 flips to closed only when the shipped rail *verifiably* relieves the crowding), `requirements.mark-complete` was deliberately NOT called — the orchestrator/verifier marks POLISH-01 at phase completion.
- **Explicit aria-labels on the icon-only rail buttons** (New chat / each nav item / Control Room / theme / Sign out). The tooltip is a visual affordance; the aria-label is the guaranteed accessible name — required for A11Y-01 do-no-harm and for `getByRole(name)` in tests.
- **The reworded removal comment** in NavPanel avoids the literal tokens `nav_panel_collapsed` / `isCollapsed` so the acceptance grep (`== 0`, which counts comments) stays honest — mirrors the Wave-0 `dangerouslySetInnerHTML` wording fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking acceptance grep] Reworded the NavPanel removal comment to avoid literal collapse tokens**
- **Found during:** Task 2 (verify greps)
- **Issue:** The comment documenting the removed collapse machinery contained the literal strings `nav_panel_collapsed` and `isCollapsed`, so `grep -c … NavPanel.tsx` returned 1 (not the required 0). The acceptance grep counts comment text.
- **Fix:** Reworded to "the persisted collapse flag, the collapse-toggle state, and the width masking are all removed" — no behavior change; both greps now return 0.
- **Files modified:** frontend/src/components/layout/NavPanel.tsx
- **Committed in:** `62d07fe8`

**Total deviations:** 1 auto-fixed (1 blocking-grep). No architectural (Rule 4) changes, no auth gates, no package installs.
**Impact on plan:** cosmetic comment wording only; all specified behavior, tokens, and structure are exactly as planned.

## Threat Surface
No new security surface. This is a pure-client IA refactor — no endpoint, query, migration, auth path, or session added/changed (Architectural Responsibility Map: Browser/Client only). The two threat-register mitigations hold verifiably:
- **T-156-01 (stored XSS via row title + filter highlight — mitigate):** titles render via `HighlightTitle` JSX text nodes; `grep -c dangerouslySetInnerHTML ChatHistoryColumn.tsx` == 0.
- **T-156-05 (operator shield EoP — mitigate):** shield stays `isOperator`-gated and OUTSIDE `NAV_ITEMS`; `nav-items.test.ts` green.

No `## Threat Flags` — nothing new introduced.

## Verification Evidence
- `npx vitest run` on the 5 relevant files → **32 passed / 0 failed** (ChatHistoryColumn 13 + a11y 6 + NavPanel 9 + nav-items 2 + ChatLayoutLaunch 2).
- `npx tsc -b` → **29 errors, 0 net-new** vs the documented 30-error baseline (the count DROPPED by 1 — the `NavPanel.tsx:3` unused-`Button` baseline error cleared with the rail refactor). No touched-file errors except the pre-existing `ChatLayoutLaunch.test.tsx:126` TS2740 mock rot (baseline — left per plan). New files (ChatHistoryColumn + its tests, the NavPanel rail + test, the ChatLayout edits) emit ZERO tsc errors.
- `npx vite build` → exit 0 (bundles cleanly; import chain resolves).
- `npm run lint:a11y` (Phase-155 CI gate) → **exit 0**.
- Source greps: `group-focus-within:opacity-100` ≥1 (A11Y-01 reveal preserved), `useStreamingThreadIds` ≥1 (SEED-064 preserved), `dangerouslySetInnerHTML` ==0, `w-[300px]` present in the column; `nav_panel_collapsed`/`isCollapsed`/`renderThreadList`/`useStreamingThreadIds` ==0, `w-[58px]` present, `isOperator &&` present in the rail.

## User Setup Required
None — frontend-only, no external service configuration, no migration, no new dependency, no cloud parity.

## Next Phase Readiness
- **Wave 2 (156-03 — ⌘K ThreadCommandPalette):** consume the SAME `matchesTitle` + `groupByDate` engine over the app-wide `threads` (now bootstrapped in ChatLayout, so the palette is never empty on non-chat views). Wire the palette open handler to the seam already in place: the `onOpenPalette?: () => void` prop on `ChatHistoryColumn` and the `{/* ⌘K chip added in Wave 2 */}` comment inside the filter box. Hand-rolled on Radix `ui/dialog.tsx` — no `cmdk` (research-resolved).
- **Wave 4 (156-04 — mobile drawer search):** the mobile drawer in `ChatLayout.tsx:234-340` is untouched here (D-08) — add the title-search box (+ optional date grouping) there.
- **Live Chrome-MCP UAT (phase gate, required):** the "rail stops starving history" / no-horizontal-overflow-at-~800px / keyboard-Tab-reaches-Stop-Rename-Delete claims need the live walkthrough (jsdom can't prove layout/contrast/scroll) before POLISH-01 is marked complete.
- No blockers.

## Self-Check: PASSED
- Files verified present: `ChatHistoryColumn.tsx` (created), `NavPanel.tsx` + `ChatLayout.tsx` (modified), `156-02-SUMMARY.md` — all FOUND.
- Commits verified in `git log`: `eac27be4` (Task 1), `62d07fe8` (Task 2), `ca38e4da` (Task 3) — all FOUND.
- Gates re-run green: 32/32 vitest across the 5 relevant files; `tsc -b` 29 (0 net-new vs 30 baseline); `vite build` + `lint:a11y` exit 0.

---
*Phase: 156-everyday-ux-polish-stretch*
*Completed: 2026-07-16*
