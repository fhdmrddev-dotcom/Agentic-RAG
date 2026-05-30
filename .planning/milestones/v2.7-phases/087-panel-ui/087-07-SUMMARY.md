---
phase: 087-panel-ui
plan: 07
subsystem: ui
tags: [react, tailwind, css-tokens, workspace-panel, chrome-mcp, uat]

requires:
  - phase: 087-06
    provides: "ChatLayout-level chat|panel grid + lifted controlled panel state machine + persistent chat-header toggle"
provides:
  - "Strengthened panel/rail surface + border tokens (--panel-surface, --panel-border) for both themes (gaps 5/6 closed)"
  - "Chrome-MCP lived-experience verification of the 004-panel-shell layout contract (overflow, flush-right, stable position, mobile, dead-band)"
affects: [087-08, 088]

tech-stack:
  added: []
  patterns:
    - "Dedicated --panel-surface / --panel-border CSS tokens (do NOT reuse --sidebar/--border) so panel contrast tunes without regressing NavPanel/AppDock"

key-files:
  created: []
  modified:
    - frontend/src/index.css
    - frontend/src/components/panel/WorkspacePanel.tsx
    - frontend/src/components/panel/PanelRail.tsx

key-decisions:
  - "Added NEW --panel-surface + --panel-border tokens rather than bumping shared --sidebar/--border (protects NavPanel which shares bg-sidebar)"
  - "Blocking human-verify checkpoint stopped at its layout/004 scope: gaps 5/6 + 004-panel-shell PASS; (d) welcome-screen toggle + 005/006/007 feature contracts + cross-provider scoreboard routed to gap plan 087-08 (operator decision 2026-05-29)"
  - "Operator directive: consolidate the panel to ONE in-panel toggle (nav-panel collapse-to-rail style) — supersedes Plan 06's chat-header toggle; handled in 087-08"

patterns-established:
  - "Panel surface contrast tuned at token level in index.css; component classNames only point at the strengthened token via the [hsl(var(--token))] arbitrary-value pattern"

requirements-completed: [PANEL-01]  # surface contrast + layout contract advanced & verified; PANEL-01 toggle UX is refined further in 087-08

duration: ~2min (Task 1) + orchestrator-driven Chrome MCP gate
completed: 2026-05-29
---

# Phase 087 Plan 07: Surface Contrast + Layout Verification Gate

**Dedicated `--panel-surface`/`--panel-border` tokens give the workspace panel + rail a distinct surface in both themes (gaps 5/6); Chrome-MCP gate verified the 004-panel-shell layout contract and routed the remaining feature contracts + cross-provider scoreboard to 087-08.**

## Performance

- **Duration:** Task 1 ~2 min code; Task 2 orchestrator-driven Chrome MCP re-verification
- **Completed:** 2026-05-29
- **Tasks:** 1 of 2 (Task 2 is a blocking human-verify gate — see below)
- **Files modified:** 3

## Accomplishments

- **Task 1 (gaps 5/6 — surface contrast):** added new `--panel-surface` and `--panel-border` tokens to `:root` (light) and `.dark`:
  - Dark: `--panel-surface: 220 40% 8%` (separates from `--background` 4% L), `--panel-border: 220 25% 24%` (clearer than the 16% body border)
  - Light: `--panel-surface: 220 15% 92%` (drops below the 97% page), `--panel-border: 220 13% 82%`
  - `WorkspacePanel.tsx` desktop `<aside>` → `border-l border-[hsl(var(--panel-border))] bg-[hsl(var(--panel-surface))]`; `PanelRail.tsx` strip → `border-l border-[hsl(var(--panel-border))]`. NavPanel/AppDock untouched (dedicated tokens).
  - tsc `--noEmit` clean; `vitest run src/components/panel` 70/70 green.

## Task Commits

1. **Task 1: Strengthen panel + rail surface/border separation (gaps 5/6)** — `54da53b7` (feat)

_Task 2 is a `checkpoint:human-verify` gate, not a code commit — its outcome is recorded below._

## Files Created/Modified

- `frontend/src/index.css` — new `--panel-surface` / `--panel-border` tokens, both themes
- `frontend/src/components/panel/WorkspacePanel.tsx` — desktop container points at strengthened surface/border
- `frontend/src/components/panel/PanelRail.tsx` — rail strip points at strengthened border

## Task 2 — Chrome MCP Re-Verification Gate (orchestrator-driven)

Ran via Chrome DevTools MCP at viewport 1442 + 1280, empty + content-heavy threads, dark + light, open/rail/hidden + mobile. Result against the plan's (a)–(h) protocol:

| # | Check | Contract | Result |
|---|-------|----------|--------|
| a | No overflow | 004 | ✅ PASS — `docScrollW == innerWidth` in open/rail/hidden @ 1442 & 1280; mobile 0 |
| b | Flush right | 004 | ✅ PASS — panel `right == innerWidth` |
| c | Stable position | 004 | ✅ PASS — `panelLeft=1088`, `gridCols=831.6px 356.4px` identical across empty + content threads (was 1230/1262/1388) |
| d | Persistent toggle | 004 | ⚠️ PARTIAL — active-thread header toggle reopens hidden panel **by mouse** (verified); **missing on the empty/welcome screen** (ChatArea welcome return block omits it). Pulsing dot wired (`workspacePending`) but not exercised live. → **087-08** |
| e | No dev leak | 004 | ✅ PASS — `[data-testid="pane-mock-eval"]` null |
| f | Mobile intact | 004 | ✅ PASS — Radix bottom Sheet, drag handle + × close, content present, overflow 0 |
| g | Surface contrast | 004/gaps 5-6 | ✅ PASS (subtle) — Task 1 verified live: dark panel + light rail read as distinct surfaces |
| h | No dead band | 004 | ✅ PASS — chat content fills/centers its 1fr column |

**Verified:** the 004-panel-shell layout contract is solid — the original overflow/flush/stable-position failures are gone.

**Routed to 087-08 (NOT verified here):**
- (d) welcome-screen reopen affordance — to be closed structurally by consolidating to a single nav-style in-panel toggle (collapse-to-rail that always persists), per operator directive
- 005-file-and-diff: multi-version VersionDiff (red/green pills, Compare, ⤢ overlay)
- 006-pending-question: live `ask_user` (paused amber run-card + locked composer + rail pulse + pinned card + chat cue → answer → resume → green)
- 007-chat-panel-seam: live SeamPointer vs reloaded self-contained SeamCard (no raw-JSON leak)
- PANEL-02/06: live todo updates with no refresh + quiet pointers, no chat flicker
- MANDATORY cross-provider 4-axis scoreboard (OpenAI · Anthropic · Google · OpenRouter × multi-tool × parallel-thread × long-message)

## Decisions Made

- Used dedicated panel tokens instead of bumping shared `--sidebar`/`--border` — protects NavPanel/AppDock which share `bg-sidebar`.
- Per operator decision (2026-05-29): Plan 07 stops at its layout/004 scope; the feature-contract + cross-provider verification (which Plan 07's gate listed as "carry-forward if data permits") was wrong to defer — it is promoted into tracked gap plan **087-08**, alongside the panel-toggle consolidation.

## Deviations from Plan

The plan's Task 2 gate was authored to require all (a)–(h) to pass before "approved". (d) did not fully pass and the three feature contracts were deferred in the plan text. Rather than approve-as-is, the operator chose to fully close via a tracked follow-up (087-08). This SUMMARY records the partial gate honestly; **Phase 087 is NOT complete** until 087-08 ships and phase verification passes.

## Issues Encountered

- The "if data permits" deferral of 005/006/007 in the plan's gate text meant the feature contracts riding on Plan 06's re-architected shared state machine went unverified — the highest-risk surfaces. Corrected by promoting them into 087-08 (see [[feedback_uat_cover_all_design_contracts]]).

## Next Phase Readiness

- 004-panel-shell layout + surface contrast verified and solid.
- 087-08 carries: single-toggle consolidation (closes (d)) + live verification of 005/006/007 + PANEL-02 + cross-provider scoreboard.
- Phase 088 (E2E reload flow) is load-bearing on the 007 seam — 087-08's seam-reload verification de-risks it.

---
*Phase: 087-panel-ui*
*Completed (Task 1 + layout gate): 2026-05-29*
