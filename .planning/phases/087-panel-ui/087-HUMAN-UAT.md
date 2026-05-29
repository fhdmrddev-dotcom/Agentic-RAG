---
status: partial
phase: 087-panel-ui
source: [087-VERIFICATION.md, 087-REVIEW.md]
started: "2026-05-29T01:57:14Z"
updated: "2026-05-29T01:57:14Z"
---

## Current Test

[awaiting human testing — run with backend up + Chrome DevTools MCP, login fhdmrd@gmail.com / 123456 at http://localhost:5173/]

## Tests

### 1. Panel three-state machine + keyboard + amber pulse
expected: Header button cycles open (~30% / clamp(300px,30%,420px)) → rail (52px) → hidden, animated via grid columns (motion-safe). ⌘. (mac) / Ctrl+. (win) toggles open↔hidden. Rail shows per-section count badges + an amber warn badge when an ask_user question is pending; the toggle shows a pulsing amber dot when a Q is pending AND the panel is closed.
result: [pending]

### 2. Mobile bottom-sheet at <768px
expected: Below 768px the panel renders as a bottom Sheet (Radix dialog, side=bottom), not the desktop grid. Touch targets are usable; the sheet does not permanently occlude the composer. (WR-03 watch: resizing across 768px while a file preview is open currently tears down drill-in state — confirm whether that's acceptable or a defect.)
result: [pending]

### 3. ask_user answer → run resume across providers (CLAUDE.md MANDATORY cross-provider axis)
expected: Trigger an ask_user prompt on OpenAI, Anthropic, Google, and one more native provider. Card renders amber pinned at panel top; Send Answer stays disabled until a choice is picked or text typed AND run_id is present; submit flips the card green/answered and the run un-pauses (SSE clears it reactively, composer unlocks). No POST to /runs/null/... ever. (WR-01/WR-02 watch: confirm a reconcile mid-prompt doesn't resurrect an answered card or freeze the countdown.)
result: [pending]

### 4. ask_user reload gap closure (live vs reloaded seam)
expected: While live, a panel-owned tool event renders as a one-line SeamPointer in chat. After a full page reload, the same turn renders as a self-contained SeamCard (never raw JSON, never the same data rich in both places — D-05 single source of truth). Answered ask_user turns are visible after reload.
result: [pending]

### 5. Rapid thread-switch reconcile-abort (086 carry-forward, now live)
expected: With a panel-hook consumer mounted, rapidly switch between threads mid-stream. The in-flight reconcile/snapshot fetch for the abandoned thread is aborted (DevTools Network shows cancellation); no stale panel data bleeds into the newly viewed thread. (This is the deferred 086 UAT item; WR-04 watch: prop-vs-useViewingThread desync window.)
result: [pending]

### 6. 4-axis UAT scoreboard (CLAUDE.md MANDATORY for streaming/provider/UI-state phases)
expected: Exercise cross-provider × multi-tool (e.g. search_documents + execute_code in one prompt) × parallel-thread (Thread A streaming while Thread B accepts a prompt) × long-message (≥50 prior messages or ≥5KB prompt). Panel todos/files/diff/ask_user all update correctly under each axis with no refresh. Partial overlap with Phase 088's formal cross-cutting gate — the 087 portion (panel responds correctly to panel-owned tool events) is in scope now.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
