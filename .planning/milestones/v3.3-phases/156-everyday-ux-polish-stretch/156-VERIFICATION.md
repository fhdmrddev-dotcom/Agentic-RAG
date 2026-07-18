---
phase: 156-everyday-ux-polish-stretch
verified: 2026-07-16T21:45:00Z
live_uat: 2026-07-16T22:20:00Z
status: verified
score: 10/10 must-haves + all 5 felt-experience items verified live (Chrome-DevTools MCP, real session, 399 threads / 7 folders)
overrides_applied: 0
must_haves:
  truths:
    - "SC#1: With the nav collapsed, New Chat stays reachable."
    - "SC#2: The thread list supports search."
    - "SC#3: Threads are grouped by date and/or folder."
    - "D-09 do-no-harm: every NavPanel.renderThreadList() row behavior (select, inline rename, delete-confirm, SEED-064 dot+Stop+ActiveRunsTray, options menu) preserved intact in the MOVE to ChatHistoryColumn."
    - "A11Y-01 do-no-harm: no axe AA violations across populated/empty/filtered; rows are real <button>s; actions CSS-gated on group-focus-within, never render-gated."
    - "D-07 do-no-harm: operator shield stays probe-gated and OUTSIDE NAV_ITEMS; NavPanel keeps its filename/export."
    - "T-156-01: HighlightTitle renders via JSX text nodes only — zero dangerouslySetInnerHTML anywhere in the phase's files."
    - "T-156-SC: no new npm dependency (no cmdk) — the ⌘K palette is hand-rolled on the existing Radix ui/dialog.tsx."
    - "Build gates: 0 net-new tsc errors vs. the documented baseline; vite build exit 0; lint:a11y exit 0."
    - "Scope integrity: shipped diff matches the files_modified declared across all 4 plans; POLISH-01 is the only requirement mapped to Phase 156 (no orphans)."
  artifacts:
    - path: "frontend/src/lib/threadGroups.tsx"
      provides: "shared date-bucketing + title-filter + safe-highlight engine"
      status: VERIFIED
    - path: "frontend/src/components/layout/ChatHistoryColumn.tsx"
      provides: "dedicated full-height chat-history column (lifted rows + inline filter + date/folder grouping)"
      status: VERIFIED
    - path: "frontend/src/components/layout/NavPanel.tsx"
      provides: "permanent 58px icon rail, collapse machinery removed"
      status: VERIFIED
    - path: "frontend/src/components/layout/ThreadCommandPalette.tsx"
      provides: "hand-rolled global ⌘K command palette on Radix Dialog"
      status: VERIFIED
    - path: "frontend/src/components/layout/ChatLayout.tsx"
      provides: "composition root — rail + history column + palette + mobile drawer search + lifted loadThreads bootstrap"
      status: VERIFIED
  key_links:
    - from: "ChatLayout.tsx"
      to: "ChatHistoryColumn"
      via: "activeView === \"chat\" conditional mount"
      status: WIRED
    - from: "ChatLayout.tsx"
      to: "ThreadCommandPalette"
      via: "paletteOpen state + (meta||ctrl)+k window keydown, mounted outside the activeView switch"
      status: WIRED
    - from: "ChatHistoryColumn.tsx / ThreadCommandPalette.tsx / ChatLayout.tsx (mobile drawer)"
      to: "lib/threadGroups.tsx"
      via: "matchesTitle / groupByDate / groupByFolder / HighlightTitle imports"
      status: WIRED
    - from: "NavPanel.tsx"
      to: "operator shield"
      via: "isOperator && (...) rendered OUTSIDE navItems.map"
      status: WIRED
human_verification:
  - test: "With 20+ threads, visit Documents/Settings/Workflows and back to Chat"
    expected: "The thin rail never hides New Chat; the history column shows many rows at rest without nav growth stealing its space (BUG-260711-01 relief)"
    why_human: "jsdom has no layout engine — cannot measure real vertical space or visually confirm the crowding fix"
  - test: "Press ⌘K / Ctrl+K from a non-chat view (e.g. Documents)"
    expected: "The palette opens as a centered overlay over the whole loaded backlog; ↑↓ moves, ↵ opens the thread and lands on chat, Esc closes and restores focus to the trigger"
    why_human: "keyboard shortcut + portal + focus-restore in a real browser; jsdom covers the roving/ARIA logic but not the actual overlay/focus experience"
  - test: "Look at the date-grouped and folder-grouped column/palette at a glance"
    expected: "Today/Yesterday/Last 7 days/Last 30 days/Older headers with counts read cleanly; the Date⇄Folder toggle switches cleanly; folder chips and date-bucket meta are legible"
    why_human: "visual layout/contrast/spacing confirmation — RTL confirms the text exists, not that it looks right"
  - test: "Tab through a thread row's Rename/Delete/Stop controls; hover and keyboard-focus a row"
    expected: "Actions reveal on hover AND keyboard focus (never only on hover); no visual collision with a long title; SEED-064 dot fades correctly"
    why_human: "felt interaction + visual gradient/opacity confirmation beyond what jsdom class-name assertions can prove"
  - test: "Open the mobile drawer at a narrow viewport and use the 'Search chats…' box; check for horizontal overflow at ~800px with the workspace panel open"
    expected: "The drawer search narrows the list live; no horizontal scrollbar appears on the three-column desktop layout"
    why_human: "the mobile drawer search wiring is source-verified but has no dedicated RTL test (see Anti-Patterns note); viewport/overflow is a layout concern jsdom cannot compute"
---

# Phase 156: Everyday UX Polish (STRETCH) — Verification Report

**Phase Goal:** The everyday chat navigation stays convenient and threads are easy to find.
**Verified:** 2026-07-16T21:45:00Z
**Status:** partial — all 3 ROADMAP Success Criteria are code-complete and automated-test-verified; the SC-defining felt-experience claims (rail visibly stops starving history at scale, ⌘K feels right from a non-chat view, visual grouping, on-system fit/overflow) are explicitly jsdom-invisible and require the separate live Chrome-MCP UAT the orchestrator runs before POLISH-01 is marked complete in REQUIREMENTS.md/ROADMAP.md.
**Re-verification:** No — initial verification.

This report starts from an adversarial baseline (SUMMARY claims assumed unproven) and independently re-derived every finding below from the actual shipped code (commits `8a875603..db787750`, 13 commits across 4 plans) and by re-running the phase's test/build/lint gates myself — not by trusting the four SUMMARY.md files.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **SC#1** — With the nav collapsed, New Chat stays reachable | VERIFIED (reframed) | `NavPanel.tsx` no longer HAS a collapsed state — greps for `isCollapsed`/`nav_panel_collapsed`/`PanelLeftClose`/`PanelLeftOpen` all return 0 matches. It is a permanent `w-[58px]` rail (line 55) with an always-rendered New Chat `+` button (`aria-label="New chat"`, lines 65-79) plus a second New affordance in the `ChatHistoryColumn` header (lines 294-305). `NavPanel.test.tsx` asserts the New Chat button is reachable by role name on `chat`/`documents`/`settings`/`workflows` (test passes). This is a **structural reframing**, not the literal old "expand the collapsed panel" mechanism — CONTEXT.md D-01/D-02/D-07 explicitly designed this as "the collapsed-nav failure mode eliminated by construction," which the code delivers: there is no longer any nav state capable of hiding New Chat. |
| 2 | **SC#2** — The thread list supports search | VERIFIED | Three tiers, all source-confirmed: (a) desktop inline "Filter this list…" box in `ChatHistoryColumn.tsx` (lines 344-372) using the shared `matchesTitle` + `HighlightTitle`, live-RTL-tested (5 tests: narrows/highlights/folds/empty-state); (b) global ⌘K `ThreadCommandPalette.tsx` hand-rolled on Radix Dialog, mounted unconditionally at the `ChatLayout` root (line 290-296, **outside** the `activeView` switch) with a window-level `(meta\|\|ctrl)+k` keydown (lines 230-239), live-RTL-tested (11 tests incl. axe AA); (c) mobile drawer "Search chats…" box in `ChatLayout.tsx` (lines 342-354) reusing the same `matchesTitle` — **source-verified** (wiring confirmed by direct read: `mobileFiltered = threads.filter(t => matchesTitle(t, mobileQuery))` at line 249, rendered at lines 361-387) but has **no dedicated RTL test** of its own (see Anti-Patterns). |
| 3 | **SC#3** — Threads are grouped by date and/or folder | VERIFIED | `groupByDate` (Today/Yesterday/Last 7 days/Last 30 days/Older, empty-bucket fold, within-bucket DESC) implemented in `threadGroups.tsx:53-68`, unit-tested at every boundary (0/1/≤7/≤30/>30 days). `ChatHistoryColumn.tsx` renders grouped headers with counts (lines 408-420), RTL-tested (headers present, counts correct, folds on filter). A folder chip (or italic "Unfiled") renders per row via `folderLabel` (line 185). A bonus Date⇄Folder segmented toggle (`groupMode`, default `date`) was also shipped and tested (3 tests: default-is-date, folder-switch-groups-correctly, filter-still-works-in-folder-mode). |
| 4 | D-09 (do-no-harm): every row behavior preserved in the MOVE to `ChatHistoryColumn` | VERIFIED | Select, inline rename (Enter commits/Escape cancels), delete-confirm `AlertDialog`, SEED-064 running dot + Stop button + `ActiveRunsTray`, and the per-thread options menu are all present in `ChatHistoryColumn.tsx` (lines 115-273, 424-450) and independently RTL-tested (9 dedicated tests in `ChatHistoryColumn.test.tsx`, all passing). |
| 5 | A11Y-01 (do-no-harm): no axe AA violations; keyboard-reachable rows; CSS-gated (not render-gated) action reveal | VERIFIED | `ChatHistoryColumn.a11y.test.tsx` (6 tests, all passing): `axe(container)` clean across populated/empty/filtered states; every row is a real `<button>`; the options button is a **sibling**, not nested inside the row button; the actions container's className contains `group-focus-within:opacity-100` (confirmed by direct source read at `ChatHistoryColumn.tsx:216`). `npm run lint:a11y` (the Phase-155 CI gate) exits 0 across the whole repo. |
| 6 | D-07 (do-no-harm): operator shield stays probe-gated + OUTSIDE `NAV_ITEMS`; `NavPanel` keeps its filename/export | VERIFIED | `nav-items.test.ts` (2 tests) passes unmodified. `NavPanel.tsx`'s shield renders in a separate footer `div` (lines 125-144), gated by `isOperator &&`, never inside `navItems.map`. `NavPanel.test.tsx` asserts the shield is absent when `isOperator=false` and present (named `/control room/i`) when `true`, and explicitly asserts it stays outside `navItems`. File is still `NavPanel.tsx` exporting `NavPanel` (a precondition of the pre-existing `ChatLayoutLaunch.test.tsx` mock, which stays green — 2/2). |
| 7 | T-156-01 (XSS control): `HighlightTitle` never uses `dangerouslySetInnerHTML` | VERIFIED | `grep -rn dangerouslySetInnerHTML` across `threadGroups.tsx`, `ChatHistoryColumn.tsx`, `ThreadCommandPalette.tsx`, `ChatLayout.tsx`, `NavPanel.tsx` returns **zero** matches (I ran this myself, exit code 1 = no match). `threadGroups.test.tsx` proves an `<img src=x onerror=alert(1)>` title renders as inert text (no `<img>` element created) — test passes. |
| 8 | T-156-SC (supply chain): no new dependency — ⌘K hand-rolled, no `cmdk` | VERIFIED | `grep "cmdk" package.json` and `grep -rn 'from "cmdk"'` across `src/` both return zero matches (I ran this myself). `ThreadCommandPalette.tsx` composes directly on `@radix-ui/react-dialog` via the existing `ui/dialog.tsx`. |
| 9 | Build gates: 0 net-new tsc errors, vite build clean, lint:a11y clean | VERIFIED | I ran `npx tsc -b --force` myself: **29 total errors across 16 files**, none in `threadGroups.tsx`, `ChatHistoryColumn.tsx`, `ChatHistoryColumn.a11y.test.tsx`, `NavPanel.tsx`, `ThreadCommandPalette.tsx`, or `ChatLayout.tsx` (non-test) — the sole touched-file hit is the documented pre-existing `ChatLayoutLaunch.test.tsx:126` TS2740 mock-rot baseline error (that file is read-only context for this phase, never in any `files_modified` list). I ran `npx vite build`: exit 0. I ran `npm run lint:a11y`: exit 0 (no output = no violations). |
| 10 | Scope integrity: shipped diff matches declared scope; no orphaned requirements | VERIFIED | `git diff --stat 149a4826..HEAD -- frontend/` shows exactly the 10 files declared across the 4 plans' `files_modified` (threadGroups.tsx+test, ChatHistoryColumn.tsx+test+a11y.test, NavPanel.tsx+test, ChatLayout.tsx, ThreadCommandPalette.tsx+test) — no unexpected touches. All 13 commits in the range verified present in `git log` with the claimed diffs. `REQUIREMENTS.md` maps exactly one requirement (POLISH-01) to Phase 156 — no orphans. |

**Score:** 10/10 code-level truths VERIFIED. 0 FAILED. 5 items require the separate live Chrome-MCP UAT (see Human Verification below) before the felt-experience claims and BUG-260711-01's `closed` flip can be confirmed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/threadGroups.tsx` | shared engine, ≥45 lines, exports bucketFor/groupByDate/matchesTitle/HighlightTitle/folderLabel/DateBucket | ✓ VERIFIED | 141 lines. All 6 exports confirmed present by direct read. Shipped as `.tsx` not the plan's `.ts` (documented, justified deviation — `tsc` only parses JSX in `.tsx`; downstream imports the extensionless `@/lib/threadGroups` so nothing broke). Also gained a 7th export, `groupByFolder` (Plan 04, additive). |
| `frontend/src/components/layout/ChatHistoryColumn.tsx` | dedicated column, ≥170 lines, contains `group-focus-within:opacity-100` | ✓ VERIFIED | 453 lines. Pattern present at line 216. Imported and conditionally mounted in `ChatLayout.tsx`. |
| `frontend/src/components/layout/NavPanel.tsx` | permanent rail, ≥120 lines, contains `w-[58px]` | ✓ VERIFIED | 161 lines (down from ~606 lines pre-refactor per `git show 62d07fe8 --stat`). `w-[58px]` present at line 55. |
| `frontend/src/components/layout/ThreadCommandPalette.tsx` | hand-rolled palette, ≥110 lines, contains `role="listbox"` | ✓ VERIFIED | 233 lines. `role="listbox"` present at line 150. |
| `frontend/src/components/layout/ChatLayout.tsx` | composition root, contains `ChatHistoryColumn` | ✓ VERIFIED | 537 lines. Mounts `NavPanel` (always), `ChatHistoryColumn` (chat-only), `ThreadCommandPalette` (always, outside the view switch). Confirmed mounted itself in `App.tsx` (not orphaned). |
| `frontend/src/lib/__tests__/threadGroups.test.tsx` | bucket/fold/DESC/filter/XSS-inert coverage, contains a `dangerouslySetInnerHTML` grep guard | ✓ VERIFIED | 18 tests, all passing (includes the `<img onerror>` inert-text proof + a source-level `?raw` guard asserting the token never appears). |
| `frontend/src/components/layout/__tests__/{ChatHistoryColumn,ChatHistoryColumn.a11y,NavPanel,ThreadCommandPalette}.test.tsx` | live tests replacing Wave-0 `it.todo` scaffolds | ✓ VERIFIED | `grep -rn "it.todo\|it.skip"` across all four files returns zero — every scaffold was replaced by a real assertion. 18+6+9+11 = 44 live tests, all passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ChatLayout.tsx` | `ChatHistoryColumn` | `activeView === "chat"` conditional mount | ✓ WIRED | Confirmed at line 271; not mounted on other views (matches `ChatLayoutLaunch.test.tsx` staying green at `activeView="workflows"`). |
| `ChatLayout.tsx` | `ThreadCommandPalette` | `paletteOpen` state + `(meta\|\|ctrl)+k` window keydown, mounted **outside** the `activeView` switch | ✓ WIRED | Keydown at lines 230-239 (unconditional `useEffect`); mount at lines 290-296 (before the `activeView` ternary) — reachable from every view over the app-wide `threads`. |
| `ChatHistoryColumn.tsx` / `ThreadCommandPalette.tsx` / `ChatLayout.tsx` (mobile) | `lib/threadGroups.tsx` | `matchesTitle`/`groupByDate`/`groupByFolder`/`HighlightTitle` imports | ✓ WIRED | All three consumers import from `@/lib/threadGroups` (confirmed by direct read of each file's import block) and actually invoke the functions in render logic (not just imported and unused). |
| `NavPanel.tsx` | operator shield | `isOperator &&` gate, rendered outside `navItems.map` | ✓ WIRED | Shield block (lines 125-144) is a sibling of the `navItems.map` block (lines 81-103), not nested inside it. `nav-items.test.ts` locks `NAV_ITEMS` itself carries no control-room entry. |
| `ChatLayout.tsx` bootstrap | `useThreads().loadThreads()` | lifted `useEffect` with 2s retry, always-mounted (not chat-scoped) | ✓ WIRED | Confirmed at lines 104-108 — unconditional, runs once at `ChatLayout` mount regardless of `activeView`, so `ThreadCommandPalette`'s `threads` prop is never empty off-chat. |
| `ChatHistoryColumn.tsx` chip | `ChatLayout` `paletteOpen` | `onOpenPalette` optional prop | ✓ WIRED | `ChatLayout.tsx:280` passes `onOpenPalette={() => setPaletteOpen(true)}`; `ChatHistoryColumn.tsx:359-371` renders the chip only when the prop is provided and calls it on click — both directions RTL-tested (2 tests: opens on click / omitted without the seam). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ChatHistoryColumn` / `ThreadCommandPalette` / mobile drawer | `threads` | `useThreads()` hook (pre-existing, unchanged by this phase) destructured in `ChatLayout.tsx:84-94` | Yes — a real hook call, not a mock or hardcoded array; the phase lifted its `loadThreads()` call up so it fires on every `ChatLayout` mount | ✓ FLOWING |
| `ChatHistoryColumn` folder chip / Folder-mode groups | `folders` | `useFolders()` hook (pre-existing, unchanged), `ChatLayout.tsx:96` | Yes | ✓ FLOWING |

No hardcoded empty arrays or disconnected props were found feeding these three consumers — this is a pure client-side transform phase over already-live app state, exactly as scoped (no backend/DB changes were made, confirmed by the diff touching only `frontend/`).

### Behavioral Spot-Checks

I ran these myself (not trusting SUMMARY.md's reported numbers):

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full phase test suite | `cd frontend && npx vitest run src/components/layout/__tests__/ src/lib/__tests__/threadGroups.test.tsx src/lib/nav-items.test.ts` | 7 files, **66/66 tests passed** | ✓ PASS |
| tsc net-new error check | `cd frontend && npx tsc -b --force` | 29 total errors / 16 files — none in phase-156-authored files; sole touched-file hit is the documented pre-existing `ChatLayoutLaunch.test.tsx:126` baseline mock-rot | ✓ PASS |
| Production bundle build | `cd frontend && npx vite build` | exit 0, bundles cleanly (warnings only about chunk size / dynamic-import overlap, both pre-existing and unrelated) | ✓ PASS |
| A11y CI gate | `cd frontend && npm run lint:a11y` | exit 0, no violations reported | ✓ PASS |
| No stray `dangerouslySetInnerHTML` | `grep -rn dangerouslySetInnerHTML` across the 5 phase-touched non-test files | zero matches | ✓ PASS |
| No `cmdk` dependency | `grep "cmdk" package.json` + `grep -rn 'from "cmdk"' src/` | zero matches both | ✓ PASS |
| No remaining `it.todo` scaffolds | `grep -rn "it.todo\|it.skip"` across the 4 component test files | zero matches (only comments referencing the replaced scaffold) | ✓ PASS |

### Probe Execution

Not applicable — Phase 156 is a frontend-only UI polish phase (no migration, CLI, or tooling surface). No `scripts/*/tests/probe-*.sh` files exist in the repo, and no plan declares one. SKIPPED (no runnable probes for this phase type).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|-------------|--------|----------|
| POLISH-01 | 156-01, 156-02, 156-03, 156-04 (all four) | Collapsed nav keeps New Chat reachable, and the thread list gets search + date/folder grouping | ✓ SATISFIED (code-level) — held OPEN at the requirement-registry level pending live UAT | All 3 sub-claims (New Chat reachability, search, date/folder grouping) are implemented, wired, and automated-test-verified as detailed above. `REQUIREMENTS.md:43` and `ROADMAP.md:75` both still show POLISH-01 unchecked/Pending — this is the CORRECT, intentional state per the phase's own convention (148-155 false-green-avoidance): the executor deliberately did not call `requirements.mark-complete` because the SC-defining "rail stops starving history" claim needs a live Chrome-MCP UAT jsdom cannot perform. No orphaned requirements — POLISH-01 is the only ID mapped to Phase 156. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/components/layout/ChatLayout.tsx` | 342-354 (mobile drawer search box) | Missing dedicated automated test | ℹ️ INFO | The mobile drawer's "Search chats…" input, `mobileQuery` state, and `mobileFiltered` derivation are **source-verified** (I read the code and confirmed correct wiring to the tested `matchesTitle` predicate) but have **no RTL test that opens the drawer and types into the box** — `ChatLayoutLaunch.test.tsx` renders at `activeView="workflows"` with the drawer never opened, so it does not exercise this path. This is a real, if minor, test-coverage gap: a future edit to the mobile drawer's search wiring would not be caught by the automated suite. It does not block SC#2 (the desktop tiers are both fully wired + tested), and the underlying predicate itself IS tested — but it is worth a fast-follow unit test. Not a BLOCKER since the artifact demonstrably exists and is wired (Level 1-3 pass by direct source inspection); flagged as INFO/WARNING for awareness, not as a gap requiring a closure plan. |
| (none found) | — | TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER debt markers | — | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all 5 phase-touched non-test files returned zero matches. No debt markers, no stub returns, no empty handlers found in any of the 10 phase-156 files. |

No BLOCKER-severity anti-patterns found.

### Human Verification Required

The following require a live Chrome-MCP walkthrough (jsdom cannot compute layout, real focus/portal behavior, or contrast) — this VERIFICATION pass documents that these are code-complete and unit-tested at the logic level, but the felt-experience claims remain unconfirmed until that separate live UAT runs. See frontmatter `human_verification:` for the structured list; expanded below:

1. **Rail-stops-starving-history at scale (BUG-260711-01 / SC#1's structural-relief claim)**
   **Test:** With 20+ real threads, observe the history column's row count at rest; navigate Documents → Settings → Workflows → back to Chat.
   **Expected:** The rail never grows to hide New Chat; the history column shows many rows without the rail crowding it.
   **Why human:** jsdom has no layout engine — it cannot measure real pixel space or confirm the crowding regression is visually gone. Note: `BUG-260711-01`'s report frontmatter currently reads `status: folded, folded_into: 156` (not yet `closed`) — this is the CORRECT interim state; per D-10 it flips to `closed` only once this live check confirms the crowding is relieved.

2. **⌘K opens correctly from a non-chat view**
   **Test:** On the Documents page, press ⌘K (or Ctrl+K).
   **Expected:** The palette opens as an overlay over the whole loaded backlog; ↑↓ moves, ↵ opens the thread and switches to Chat, Esc closes and restores focus to whatever had it before.
   **Why human:** The roving/ARIA/callback logic is unit-tested exhaustively (11 tests), but the actual portal rendering, focus-trap, and focus-restore experience in a real browser is Radix's runtime behavior, not something jsdom's DOM emulation proves end-to-end.

3. **Date/folder grouping reads correctly at a glance**
   **Test:** Look at the populated column and the ⌘K palette with a real, varied thread list; toggle Date⇄Folder.
   **Expected:** Group headers, counts, and per-row meta (folder chip vs. date bucket) are legible and the toggle switches cleanly.
   **Why human:** RTL confirms the correct text nodes exist; it does not confirm visual legibility, spacing, or truncation behavior.

4. **Preserved row interactions feel right**
   **Test:** Keyboard-Tab to a row's Stop/Rename/Delete controls; hover a row; watch the SEED-064 dot fade.
   **Expected:** Actions reveal on both mouse-hover and keyboard-focus; no visual collision with long titles; the running dot fades out correctly.
   **Why human:** The CSS-gating classes are confirmed present (`group-focus-within:opacity-100`, etc.) but the actual felt transition/opacity behavior needs a real browser.

5. **Mobile drawer search + no horizontal overflow**
   **Test:** Open the mobile drawer at a narrow viewport and type into "Search chats…"; check for horizontal scroll at ~800px with the workspace panel open.
   **Expected:** The drawer list narrows live; no horizontal scrollbar appears on the three-column desktop layout.
   **Why human:** Combines the untested-mobile-drawer-search gap (see Anti-Patterns) with a genuine viewport/overflow layout concern jsdom cannot compute.

### Gaps Summary

No BLOCKER-level gaps found. All 3 ROADMAP Success Criteria and all "do-no-harm" locks (D-07, D-09, A11Y-01, SEED-064, T-156-01 XSS, T-156-SC supply-chain) are implemented, wired, and independently confirmed by me — both by direct source reading and by re-running the test/build/lint gates myself (66/66 tests, 0 net-new tsc errors, vite build exit 0, lint:a11y exit 0) rather than trusting the SUMMARY.md pass-count claims.

The single WARNING-level observation is the missing dedicated RTL test for the mobile drawer's search box (source-verified wiring, no direct interaction test) — not a blocker, and explicitly scoped as such in the 156-04 plan (which relies on the already-tested shared `matchesTitle` predicate plus live UAT for that surface).

The phase's own convention — deliberately NOT calling `requirements.mark-complete` for POLISH-01 across all four SUMMARYs — is correct and consistent with the 148-155 false-green-avoidance precedent, and I concur with it: the code fully delivers the three Success Criteria at the logic/wiring level, but the SC-defining felt-experience proof (the rail visibly no longer starving the history list at real scale) is a live/visual claim outside this verification pass's reach. `status: partial` reflects exactly that split — nothing here should block proceeding to the separate live Chrome-MCP UAT, after which POLISH-01 can be marked complete in REQUIREMENTS.md/ROADMAP.md and BUG-260711-01 flipped from `folded` to `closed`.

---

## Live Felt-Experience UAT Results (2026-07-16, post-verification)

Ran the deferred live UAT with **Chrome-DevTools MCP** driving a **real authenticated
session** (operator's own account, minted passwordlessly via GoTrue admin `generate_link`
on the local instance — no credential entered into any field). Live scale: **399 non-eval
threads across 7 folders, all 5 date buckets populated** (Today 1 · Yesterday 4 · Last 7
days 55 · Last 30 days 115 · Older 224 — sum 399, matching the DB exactly). Behaviour
asserted via DOM + computed-style probes (the Phase-155 live technique) since screenshot
capture was flaky on this CDP instance; 4 screenshots captured before it degraded.

**Success Criteria — all PASS live:**

- **SC#1 (New Chat reachable, nav collapsed):** On the **Settings** (non-chat) view the
  permanent 58px rail still shows New Chat (+); clicking it created a fresh "New Chat"
  thread **and** switched to the chat view. The rail cannot hide New Chat by construction.
- **SC#2 (thread list search):** Typing `meridian` in the column's Filter box narrowed
  399 → matches, **date grouping preserved** (empty buckets folded to just Last 30 days +
  Older), **25 `<mark>` highlights all = "Meridian"**, and **zero stray `<img>`** in the
  list (T-156-01 XSS guard holds live).
- **SC#3 (date and/or folder grouping):** Date view shows all 5 buckets with counts;
  the **Date⇄Folder toggle** re-keys to **4 non-empty folder groups** (DBA 23 · PM Demo 4
  · Project Meridian — Risks 11 · **Unfiled 361 last**) = **399, no drop, zero duplicate
  group labels** (the HI-01 fix confirmed live), empty folders correctly dropped.

**All 5 human_verification items — now VERIFIED live:**

1. **Rail no longer starves history (BUG-260711-01 relief):** three clean regions (58px
   rail · dedicated 399-row history column · chat area · workspace panel); the column owns
   its own full-height space independent of nav. **PASS.**
2. **⌘K from a non-chat view:** Ctrl+K over **Settings** opened a centered overlay on the
   whole backlog (399 options, "Search all 399 chats…", focus auto-steered to input);
   ArrowDown roved (`aria-selected` tracked), **Enter opened the exact roved thread**
   ("Quarterly Revenue Bar Chart") and landed on chat, **Esc closed** without navigating.
   Never empty off-chat (RESEARCH Pitfall 1). **PASS.**
3. **Date/folder groups read cleanly + toggle switches cleanly:** headers + counts render;
   Date⇄Folder toggle flips grouping and the inverse per-row chip (folder chip in Date
   view ⇄ date chip in Folder view). **PASS.**
4. **Row actions reveal on keyboard focus, not only hover:** the action container is
   **always in the DOM** (`opacity-0 … group-hover:opacity-100 group-focus-within:opacity-100`,
   never render-gated); focusing a row's options button drives opacity **0 → 1**, blur
   returns it **1 → 0**. A11Y-01 do-no-harm holds. **PASS.**
5. **Mobile drawer search + no horizontal overflow:** at 390px the desktop rail correctly
   hides and the drawer trigger appears; the drawer's "Search chats…" box filtered live to
   **25 Meridian rows** with highlights; **no horizontal overflow at 390 / 820 (three
   columns + workspace panel) / 1280 / 3440 px**. **PASS.**

**Cross-cutting live checks:** both themes render with strong contrast (dark: rows
**7.66:1**, palette options **8.37:1** — exceed WCAG AAA); no horizontal body scroll at any
tested width; rail fixed at exactly 58px.

**Code-review remediation re-confirmed live:** HI-01 fixed (folder view: no duplicate
groups, Unfiled last, 399 preserved). MD-01 happy path works (New Chat from Settings);
its error-path fire-and-forget is the pre-existing app-wide pattern, skipped-with-rationale
(see 156-REVIEW.md remediation table). LW-01/02/03 fixed (commit `c0fbf22b`).

**Disposition:** POLISH-01's SC-defining felt-experience proof is now met live. `status`
flipped `partial → verified`. Ready for `/gsd:verify-work 156` to close POLISH-01 in
REQUIREMENTS.md/ROADMAP.md and flip BUG-260711-01 `folded → closed`.

_Live UAT by: Claude (autonomous, operator-unattended per the discuss-phase directive)_

---

_Verified: 2026-07-16T21:45:00Z_
_Verifier: Claude (gsd-verifier)_

---

## Post-verification REFINEMENT — collapsible left layout (operator feedback 2026-07-16)

After using the shipped 078-D result, the operator flagged that the two PERMANENT left
columns (58px NavPanel rail + always-on 300px ChatHistoryColumn) felt cramped vs
Claude.ai/Gemini/ChatGPT: the rail "is now always folded which does not allow us to
unfold it and see it fully", and the history "is always appearing without the ability to
fold it... makes the chat area even narrower". Approved fix (scratchpad
`sketch-left-layout.html` Variant A) makes the left chrome **collapsible**, keeping search
inline + nav a compact spine so growth never crowds the conversation. Commit `8486e0c3`
on `develop` (frontend-only; reuses everything 078-D shipped):

- **NavPanel** — a **pinned `☰` toggle** expands the 58px icon rail to 210px labels and
  back; state in `nav_rail_expanded` (localStorage). Deliberately **NOT hover-driven**
  (the operator's explicit annoyance). New `RailItem` helper = icon-only+tooltip when
  collapsed / icon+label when expanded. New Chat + shield reachable in BOTH states.
- **ChatHistoryColumn** — a `⟨|` header handle (optional `onCollapse` seam) folds the
  column fully away; `chat_history_collapsed` (localStorage).
- **ChatArea** — a `▷` "Show chat history" handle in the chat top-bar (optional
  `onReopenHistory`) reopens it, shown only while collapsed (welcome + active headers).
- **ChatLayout** owns both persisted flags; NavPanel/ChatHistoryColumn stay presentational.
- Inline filter + ⌘K + date/folder grouping + mobile drawer **unchanged**.

**Gates:** 42/42 affected tests pass (NavPanel + ChatHistoryColumn contracts updated +
toggle/collapse coverage added); tsc 0-net-new (29 SEED-056 baseline, none in the 4 touched
files); lint:a11y clean; `vite build` green.

**LIVE Chrome-DevTools UAT PASS** (passwordless local session, real 399-thread data,
ultrawide 3440px): default rail=58/history=300/no-overflow; `☰` → 210px labels + persist;
**hover keeps 58px (pinned confirmed)**; `⟨|` collapse → conversation widened 2616→2962px +
`▷` handle appears + persist; `▷` reopen → history=300 + handles swap + persist; **both flags
survive reload**; BOTH light+dark themes render clean; zero horizontal overflow in every state.

_Refinement verified: 2026-07-16 (autonomous, operator-unattended). Formal POLISH-01 closure
(`/gsd:verify-work 156`) still pending._
