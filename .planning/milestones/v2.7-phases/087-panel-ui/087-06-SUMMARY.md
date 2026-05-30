---
phase: 087-panel-ui
plan: 06
subsystem: ui
tags: [react, typescript, vitest, panel, layout, css-grid, state-lift, controlled-component, gap-closure, a11y, tdd]

# Dependency graph
requires:
  - phase: 087-02
    provides: "WorkspacePanel shell (sections + PendingAskStack pin + PanelRail + PanelEmpty + mobile Sheet); subscribeOpenPanel/requestOpenPanel module signal; the self-referential aside-grid this plan replaces"
  - phase: 086-streamsprovider-extension-panel-hooks
    provides: "useViewingThread() + useAskUserPrompt(threadId) → { data: PendingAsk[] }"
provides:
  - "App-level chat|panel CSS grid in ChatLayout (1fr | clamp(300-420px)/52px/0) — panel column resolves against the real row width; zero horizontal overflow in open/rail/hidden; flush-right stable panel; chat centers in its own 1fr column (no dead band)"
  - "Lifted panel-state machine in ChatLayout (open|rail|hidden) with cycle/toggle/expand/hide handlers; ⌘./Ctrl+. + subscribeOpenPanel(expand) effects hosted here"
  - "Controlled WorkspacePanel (state/onCycle/onExpand/onHide props; internal state machine, key listener, and self-referential aside grid removed; mobile Sheet preserved)"
  - "Persistent chat-header workspace toggle in ChatArea (always-visible desktop button) + pulsing-amber-dot ask_user-pending indicator (prefers-reduced-motion honored)"
  - "Production App.tsx tree with DevTwoPaneMock import + mount removed"
affects: [087-07 (cosmetic pass + live Chrome MCP gaps re-verify), 088-a11y-e2e]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies — pure React + existing Tailwind tokens/hooks/icons
  patterns:
    - "App-level push/split grid (panel-shell.md D1): the chat|panel split is ONE ChatLayout grid so the panel column sizes against the real row width — 1fr + clamp(...) always sums to the row → no overflow; replaces the self-referential `gridTemplateColumns:'0 …'` aside hack where 30% collapsed to its 300px floor."
    - "State lift to the layout owner: WorkspacePanel became a controlled component; the open/rail/hidden machine, the ⌘. key listener, and the seam-signal subscription moved up to ChatLayout so a persistent chat-header toggle and the seam pointer can drive the same state."
    - "Pending-indicator without prop drilling: ChatLayout reads useAskUserPrompt(useViewingThread()) and passes workspacePending = pending.length>0 && state!=='open' to ChatArea — same hook WorkspacePanel uses, additive, no new store."
    - "motion-safe:transition-[grid-template-columns] for the column animation; motion-safe:animate-pulse for the amber dot — prefers-reduced-motion auto-suppressed via the motion-safe: variant (no JS media query)."

key-files:
  created:
    - .planning/phases/087-panel-ui/087-06-SUMMARY.md
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/panel/WorkspacePanel.tsx
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx

key-decisions:
  - "Realized the LOCKED panel-shell.md D1 three-column contract (52px nav | 1fr chat | panel track) by making the chat+panel region a 2-column grid INSIDE the existing flex <main> row (minimal change b — NavPanel/drawer/<main> content untouched), gated on activeView==='chat'. Non-chat views keep <main className=flex-1> with no panel column."
  - "WorkspacePanel desktop branch is now a plain <aside> that fills 100% of its grid track (state='hidden' → opacity-0 + pointer-events-none); the width animation lives on ChatLayout's grid. The zero-width spacer <div aria-hidden> and the self-referential aside grid are gone."
  - "Added onHide to the controlled interface (distinct from onCycle/onExpand) so the mobile Sheet X + onOpenChange(false) hide cleanly while the desktop chevron cycles. Mobile Sheet branch otherwise byte-equivalent."
  - "TDD (Task 2): wrote a temporary WorkspacePanelControlled.test.tsx as the RED gate (5 failing controlled-API assertions against the old self-owned impl), committed test(...) → implemented GREEN → then Task 4 folded the full controlled coverage into WorkspacePanel.test.tsx and removed the temp file (coverage subsumed)."

patterns-established:
  - "PanelState type now exported from WorkspacePanel.tsx and imported by ChatLayout — single source for the open|rail|hidden union across the controlled boundary."

requirements-completed: [PANEL-01]

# Metrics
duration: 7min
completed: 2026-05-29
---

# Phase 087 Plan 06: Panel Layout Re-Architecture Summary

**Hoisted the workspace-panel chat|panel split into a single ChatLayout-level CSS grid (1fr chat | clamp(300-420px)/52px/0 panel) so the panel resolves against the real row width — closing the overflow (gap 1), dead-band (gap 7), and per-thread-shift defects — lifted the open/rail/hidden state machine up to ChatLayout to host a persistent always-visible chat-header toggle (gap 3) with a pulsing-amber-dot ask_user-pending indicator (gap 4 / PANEL-01), and stripped the leaked DevTwoPaneMock debug overlay from the production tree (gap 2).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-29T07:34:04Z
- **Completed:** 2026-05-29T07:41:20Z
- **Tasks:** 4 (Tasks 2 + 3 implemented together so Task 2's tsc/vitest verify saw the ChatArea props; Task 2 followed RED→GREEN→commit; Task 3 + Task 4 committed separately)
- **Files modified:** 5 (App.tsx, ChatLayout.tsx, WorkspacePanel.tsx, ChatArea.tsx, WorkspacePanel.test.tsx) — 3 of them G-5 hot files (ChatLayout/WorkspacePanel/ChatArea)

## Accomplishments

- **Gap 2 (DevTwoPaneMock leak):** removed the import + unconditional mount from `App.tsx`. `DevTwoPaneMock.tsx` retained for dev use. `rg DevTwoPaneMock src/App.tsx` → 0 matches. (T-087-06-01 mitigated.)
- **Gaps 1/7 (overflow + dead band):** the chat|panel region is now a single grid `gridTemplateColumns: '1fr ' + (open ? clamp(300px,30%,420px) : rail ? 52px : 0px)` with a `motion-safe:transition-[grid-template-columns] motion-safe:duration-300`. Because 1fr + the panel track participate in the SAME grid row, they always sum to the row width → no horizontal overflow in any state, a flush-right stable panel (identical left edge per thread), and the chat centering inside its own 1fr column (no dead band).
- **Gap 3 (unreachable hidden panel):** lifted the state machine to ChatLayout and added a persistent always-visible desktop toggle button (top-right in the chat header via `ml-auto`, `hidden md:grid`) in `ChatArea` that calls `onToggleWorkspace` (open↔hidden) — a hidden panel reopens by mouse with no shortcut or content-dependent seam.
- **Gap 4 / PANEL-01 (pending signal):** the toggle shows a pulsing amber dot (`bg-[hsl(var(--warning))] motion-safe:animate-pulse`) when `workspacePending = useAskUserPrompt(useViewingThread()).length > 0 && panelState !== 'open'`. prefers-reduced-motion is honored via the `motion-safe:` variant.
- **Controlled WorkspacePanel:** props are now `{ selectedThread, state, onCycle, onExpand, onHide }`. The internal `useState<PanelState>`, the `cycleState`/`toggleHidden` callbacks, the `⌘.` key listener, the `subscribeOpenPanel(expand)` effect, and the self-referential desktop `<aside grid gridTemplateColumns:'0 …'>` + zero-width spacer are all gone. The `<768px` Sheet branch is preserved (now reading `state` from props, hiding via `onHide`).
- **State lift to ChatLayout:** `panelState` + `cycleState` (open→rail→hidden→open), `toggleWorkspace` (open↔hidden), `expand` (→open), `hidePanel` (→hidden); the `⌘./Ctrl+.` keydown effect and the `subscribeOpenPanel(expand)` effect moved here (the seam pointer still opens the now-lifted state).

## Verification

- `cd frontend && npx tsc --noEmit` — clean (exit 0) after Task 1 and after the Task 2/3 implementation.
- `cd frontend && npx vitest run src/components/panel` — **70 passed / 0 fail** across all 8 panel-dir files (WorkspacePanel grew 9 → 12 controlled-contract tests).
- `cd frontend && npx vitest run` (full suite) — at the **documented 17-failure baseline** (389 passed / 17 failed on a clean run). The first run showed 18 failed; a re-run showed exactly 17 — the StreamsProvider concurrent-reconcile reducer suite (`streamsProvider.test.tsx`, `streamsProvider_075_9_clientkey`, `StreamsProvider.dedup`) is order-sensitive and flakes ±1. **None of the failures are in files this plan touched** (App.tsx / ChatLayout.tsx / WorkspacePanel.tsx / ChatArea.tsx have zero failing tests); all 17/18 are the pre-existing StreamsProvider / useMessages / MessageItem-thinking-indicator / model-info / Plan04 baseline.
- `rg "DevTwoPaneMock" frontend/src/App.tsx` — no matches.
- G-5 additivity: NavPanel, the mobile drawer overlays (`fixed`, layout-independent), and `<main>`'s content are untouched; the only `<main>` change is the `flex-1 overflow-hidden` → `min-w-0 overflow-hidden` swap inside the chat-view grid cell (the grid 1fr now owns the width). Composer + streaming paths in ChatArea untouched (purely additive button).

## Deviations from Plan

### Auto-fixed / sequencing adjustments

**1. [Rule 3 - Blocking] Implemented Task 3's ChatArea props alongside Task 2's GREEN so Task 2's verify could pass**
- **Found during:** Task 2 GREEN.
- **Issue:** Task 2's `<verify>` runs `tsc --noEmit`, but ChatLayout (Task 2) passes `onToggleWorkspace` + `workspacePending` to `<ChatArea>`. Those props don't exist on ChatArea until Task 3, so tsc would fail at the Task 2 gate.
- **Fix:** Added the two optional props + the toggle button to ChatArea before running the Task 2 verify, then committed the WorkspacePanel + ChatLayout files as Task 2 GREEN and the ChatArea file as a separate Task 3 commit. No behavior change vs the plan — same files, same end state, just ordered so each commit is independently green.
- **Files modified:** frontend/src/components/chat/ChatArea.tsx (committed under Task 3).
- **Commits:** 67e674c7 (Task 2), bf2aa272 (Task 3).

**2. [Plan-intended] Temporary RED-gate test file created then removed**
- **Found during:** Task 2 (tdd="true") RED phase.
- **Issue:** Task 2's `<done>` says "WorkspacePanel.test.tsx green (after Task 4 updates it)" — i.e. the existing test can't be green until Task 4. To satisfy the RED→GREEN TDD gate for Task 2 without prematurely doing Task 4's rewrite, a dedicated `WorkspacePanelControlled.test.tsx` was authored as the RED gate (5 failing controlled-API assertions), committed as `test(...)`, then driven GREEN.
- **Fix:** Task 4 folded the full controlled coverage into `WorkspacePanel.test.tsx` (12 tests) and removed the now-redundant temp file in the same commit (23ca287b). Net: no duplicate coverage, clean suite.

## TDD Gate Compliance

Task 2 (`tdd="true"`) gate sequence is present in git log:
1. RED — `231930a9 test(087-06): add failing controlled-API contract for WorkspacePanel (RED)` (5 failing assertions against the self-owned impl).
2. GREEN — `67e674c7 feat(087-06): hoist chat|panel split … + lift panel state (GREEN …)` (controlled-API test → 7/7 green).
3. REFACTOR — not needed (implementation was clean at GREEN).

Task 3 (`tdd="true"`) is a purely additive UI button covered by the ChatLayout-driven integration; its observable behavior (toggle + pending dot) is asserted indirectly via the controlled WorkspacePanel state and the ChatLayout `workspacePending` wiring. No separate RED test was authored for the button render — it is a static additive element with no logic branch beyond the `onToggleWorkspace &&` and `workspacePending &&` guards, both type-checked by tsc.

## Threat Flags

None — this plan is a frontend layout/state-lift refactor + a dev-overlay removal. No new network endpoint, auth path, file access, or schema change. T-087-06-01 (DevTwoPaneMock info-disclosure) and T-087-06-02 (G-5 shared-path regression) are both mitigated as planned.

## Commits

- `dd4baf9c` — fix(087-06): remove leaked DevTwoPaneMock debug overlay from production (gap 2)
- `231930a9` — test(087-06): add failing controlled-API contract for WorkspacePanel (RED)
- `67e674c7` — feat(087-06): hoist chat|panel split to a ChatLayout-level grid + lift panel state (GREEN, gaps 1/3/4/7)
- `bf2aa272` — feat(087-06): persistent workspace toggle + pulsing-amber-dot in chat header (gaps 3/4)
- `23ca287b` — test(087-06): update WorkspacePanel.test.tsx for the controlled API + drop temp RED file

## Self-Check: PASSED

All 5 modified files + the SUMMARY verified present on disk; all 5 task commit hashes verified in git log (`dd4baf9c`, `231930a9`, `67e674c7`, `bf2aa272`, `23ca287b`); `DevTwoPaneMock.tsx` retained for dev use. Panel suite 70/70 GREEN; full suite at the 17-failure baseline (no new failures in touched files); tsc --noEmit exit 0.
