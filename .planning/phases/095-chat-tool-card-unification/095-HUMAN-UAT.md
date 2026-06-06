---
status: partial
phase: 095-chat-tool-card-unification
source: [095-VERIFICATION.md, 095-VALIDATION.md, 095-REVIEW.md]
started: 2026-06-06T00:00:00Z
updated: 2026-06-06T00:00:00Z
---

## Current Test

[awaiting human testing — live Chrome-DevTools-MCP UAT across the 6 native providers]

## Tests

### 1. Long run stays honest (timer + step-count + single sub-agent)
expected: On a ~11-step run (Kimi/Moonshot representative), the run timer stays
visible and ticks continuously for the FULL duration (closing
`timer-disappears-long-runs`); the step count shown by the timer/RunStatusStrip
EQUALS the panel count (closing `step-count-mismatch-timer-vs-panel`); any
sub-agent (`analyze_document`) appears EXACTLY ONCE — no double-render (closing
BUG-260529-02 #3). Also watch WR-03: confirm whether an out-of-order
`sub_agent_start` (before `tool_start`) ever drops the real tool's args onto a
synthetic owner row.
result: [pending]

### 2. Multi-tool run is calm (collapse + auto-scroll + jump-to-live)
expected: A single prompt exercising `search_documents` + `execute_code` renders
both tool-cards in ONE consistent frame; finished cards fold (details-on-demand,
click-to-expand); the active card stays open; the chat follows the live edge but
RELEASES when you scroll up (D-03 follow-but-release), and the floating
"↓ Jump to live" chip appears on scroll-away and returns you to the bottom.
result: ISSUE — operator 2026-06-06: the fold/unfold of completed tasks is NOT
per-card. Expanding ONE completed tool-card expands EVERY completed tool-card at
once (violates D-01 click-to-expand + SC#1 details-on-demand collapse).
→ gap: BUG-FOLD-ALL (shared collapse-state in ToolCallPanel)

### 3. Hero file downloads — immediately AND next-day (reload honesty)
expected: Ask the agent to generate a `.docx` (or `.pptx`/`.pdf`). The output
renders a hero "★ Your file" card (with the per-extension file icon) above any
collapsible "Working files (N)" group; the Download link works END-TO-END (no
dead link) right away. Reopen the chat (simulate next-day reload) → the hero card
still renders and the download STILL works. Watch WR-02: on a MULTI-CELL
`execute_code` run, confirm the reloaded panel shows ONE hero card, not several.
Watch WR-01: confirm the reloaded run's elapsed timer is not absurdly inflated
(e.g. `1440m 0s` for a day-old run).
result: ISSUE — operator 2026-06-06: the highlighted (hero) section sometimes
includes WORKING files alongside the genuine final file — the hero/working split
leaks. Confirms code-review WR-02 live.
→ gap: BUG-HERO-LEAK (more than one is_hero / partition mis-bucket)

### 4. Two threads + 6-provider parity (SC#10 4-axis)
expected: Thread A streaming while Thread B accepts a new prompt — no cross-thread
bleed, no global isStreaming lockout (parallel-thread axis); a long-message /
≥50-prior-message thread behaves (long-message axis); the unified frame, timer,
step-count, dedup, and hero/working file split behave IDENTICALLY across all 6
native providers (OpenAI, Anthropic, Google, Moonshot, GLM/zhipu, MiniMax) —
cross-provider axis. PANEL-06 panel isolation must not regress.
result: [pending]

### 5. Design fidelity vs the sketch contract (014/015/016)
expected: The rendered chat tool-card / run-card / status-strip / scroll surfaces
AND the output-files hero/working surface match the operator-approved sketch
design contract (sketch-findings-agentic-rag — sources 014/015/016).
result: ISSUE — operator 2026-06-06: "overall good but NOT THE SAME as the
sketches design." Non-specific; concrete divergences under diagnosis (workflow
wf_a263d71a-919). To confirm scope with operator before building.
→ gap: DESIGN-DIVERGENCE (specifics TBD from diagnosis)

## Summary

total: 5
passed: 0
issues: 3
pending: 2
skipped: 0
blocked: 0

## Gaps

Operator live-UAT (2026-06-06) surfaced 3 issues — diagnosis in progress
(workflow wf_a263d71a-919, adversarially verified). Root causes + fix directions
land here before gap-plan:

- **BUG-FOLD-ALL** (status: diagnosing) — expanding one completed tool-card
  expands all; shared collapse-state in `ToolCallPanel.tsx`. Violates D-01 +
  SC#1 (details-on-demand collapse).
- **BUG-HERO-LEAK** (status: diagnosing) — working files leak into the hero
  highlight; >1 is_hero (WR-02) or frontend partition mis-bucket. Spans
  `agent_loop.py` + `MessageItem.tsx` FinalOutputsPanel. Touches SC#1 (no dup) /
  the file-axis honesty.
- **DESIGN-DIVERGENCE** (status: diagnosing) — implementation diverges from the
  sketch contract; concrete list + operator scope confirmation pending.

WR-03 (StreamsProvider out-of-order sub_agent_start arg-drop) remains a
watch-item, not operator-confirmed.
