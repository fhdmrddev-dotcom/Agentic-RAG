---
phase: 087-panel-ui
plan: 08
type: gap-closure-context
created: 2026-05-29
source: operator-directive + 087-07 checkpoint findings
---

# 087-08 Context — Toggle Consolidation + Full Design-Contract Verification

## Why this plan

Two operator decisions on 2026-05-29, after the Plan 07 blocking Chrome-MCP checkpoint:

1. **Fully close, no approve-as-is.** Plan 07's gate verified the 004-panel-shell *layout* contract (overflow/flush/stable-position/mobile/contrast all PASS) but (a) surfaced a real (d) gap — the persistent reopen toggle is missing on the empty/welcome screen — and (b) deferred the three feature contracts (005/006/007) + the cross-provider scoreboard as "carry-forward if data permits". Deferring was wrong: those features ride on the shared panel state machine Plan 06 re-architected, so they are the highest-risk surfaces. They are promoted into this plan as a blocking live gate.

2. **One toggle, inside the panel, like the nav panel.** The panel currently has TWO collapse/expand controls (in-panel "Collapse workspace" + the redundant ChatArea chat-header "Toggle workspace" added by Plan 06) and a fully-hidden state. Mirror NavPanel: a single in-panel button, collapse-to-rail (open↔rail), rail always present. This removes the redundant control AND structurally closes (d) — the rail + its expand control persist on every thread, including the welcome screen, and give the pulsing-amber-dot a permanent host.

## Locked decisions

- **State machine:** `PanelState` becomes `"open" | "rail"` (drop `"hidden"`). Single in-panel toggle, nav-parity. `⌘./Ctrl+.` toggles open↔rail. Grid panel track: `clamp(300px,30%,420px)` (open) / `52px` (rail) — no `0` column.
- **Remove** ChatArea `onToggleWorkspace` prop + the chat-header "Toggle workspace" button from both return blocks; remove the call-site prop in ChatLayout.
- **Pulsing-amber-dot** moves onto the rail's always-present Expand control.
- **Surface tokens from Plan 07 unchanged**; feature components (FilesSection/VersionDiff/PendingAskCard/Seam) internals unchanged — additive-safe.
- **Design contract** panel-shell.md (004) updated to the nav-style collapse-to-rail; prior 3-state language marked superseded.

## Verification bar (G-4 lived-experience, blocking)

ALL four design contracts verified LIVE via Chrome MCP — no deferrals, seed the runs:
- 004 single-toggle collapse-to-rail + welcome-thread reopen-by-mouse + no-overflow/flush/stable + 768/1024/1440 + mobile sheet
- 005 multi-version VersionDiff (pills, Compare, ⤢ overlay) — seed a double-write of one file
- 006 live ask_user (paused amber run-card + locked composer + rail pulse + pinned card + chat cue → answer → resume → green) — seed an ask_user prompt
- 007 seam (live SeamPointer ↔ reloaded self-contained SeamCard, no raw-JSON) — run panel tools, reload
- PANEL-02/06 live todos no-refresh + quiet pointers, no flicker
- **Cross-provider 4-axis scoreboard** (OpenAI·Anthropic·Google·OpenRouter × multi-tool × parallel-thread × long-message) — MANDATORY per CLAUDE.md; rows in 087-VALIDATION.md

## Downstream

Phase 088 (E2E reload flow) is load-bearing on the 007 seam — this plan's seam-reload verification de-risks it.

## Guardrail notes

- **G-2 (sketch-before-plan for UX):** the toggle rework is operator-directed to mirror an EXISTING in-app pattern (NavPanel) — NavPanel is the reference mockup, so no new sketch required. Recorded as an informed skip, not silent.
- **G-5 (hot files):** ChatLayout/WorkspacePanel/ChatArea are on the hot-file ledger but marked "satisfied (075.7)"; this is a small, bounded consolidation, not a new feature wave — no refactor phase required first.
