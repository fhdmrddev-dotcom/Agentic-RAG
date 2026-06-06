---
status: partial
phase: 095-chat-tool-card-unification
source: [095-VERIFICATION.md, 095-VALIDATION.md, 095-REVIEW.md]
started: 2026-06-06T00:00:00Z
updated: 2026-06-06T12:00:00Z
---

## Current Test

[awaiting human RE-test — all 3 operator gaps + the WR-01 code-review regression
are now CODE-CLOSED by gap plans 095-06..09 (+ commit 4065580b). Re-run the live
Chrome-DevTools-MCP UAT across the 6 native providers to confirm the felt
experience matches before closing the phase. Code evidence is verified (4/4
must-haves, zero net-new test failures) but the lived-experience axes can only be
confirmed in a real browser with real providers.]

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
result: [pending — original 095-01..05 work; not re-touched by gap plans]

### 2. Multi-tool run is calm (collapse + auto-scroll + jump-to-live)
expected: A single prompt exercising `search_documents` + `execute_code` renders
both tool-cards in ONE consistent frame; finished cards fold to a single essence
line (details-on-demand, click-to-expand) from step 1; the active card stays open
and blooms; the chat follows the live edge but RELEASES when you scroll up (D-03);
the floating "↓ Jump to live" chip (status-first, jump trailing) appears on
scroll-away and returns you to the bottom WITHOUT a double-framed pill.
result: [pending re-test — FIX SHIPPED] Plan 095-06 replaced the shared
`stepsCollapsed` boolean with a per-step `expandedSteps` Set (one click expands
ONLY that card), un-gated the fold (essence from step 1), and added the active
bloom. WR-01 (floating-chip double-frame) fixed via the `header-bare` strip
variant. Verify the per-card fold/unfold is now independent and the chip is a
single pill.

### 3. Hero file downloads — immediately AND next-day (reload honesty)
expected: Ask the agent to generate a `.docx` (or `.pptx`/`.pdf`). The output
renders a hero "★ Your file" card (per-extension icon, 48px) above a collapsible
"Working files (N) — intermediates, all downloadable" group; the Download link
works END-TO-END right away. Reopen the chat (next-day reload) → the hero card
still renders and the download STILL works. WR-02: on a MULTI-CELL `execute_code`
run, confirm the panel shows EXACTLY ONE hero card both live AND on reload (they
must agree). WR-01-timer: confirm the reloaded run's elapsed timer is not absurdly
inflated.
result: [pending re-test — FIX SHIPPED] Plan 095-09 made `_select_hero_filenames`
return exactly ONE hero on every branch and shares one canonical `_hero_set`
between the live emit and the persist re-stamp (live == reload). Plan 095-08
applied the 48px hero icon, 24px soft halo, and the "intermediates" copy. Verify
exactly one hero (not the CSV/scratch file) live and after reload.

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
result: [pending re-test — FIXES SHIPPED] Plans 095-06/07/08 landed all
diagnosed divergences (essence line, un-gate, bloom, pill chrome, single verb,
`turn N` run-sub, hero 48/working 30, soft halo, borderless top-rule + dim
eyebrow, intermediates copy, status-first chip). SEED-054 deferred the per-file
subtitle + SVG-icon items. Verify the surfaces now read as the sketches.

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

**All 3 operator gaps + WR-01 are CODE-CLOSED — pending operator live re-UAT.**

Gap closure: plans 095-06..09 (gap_closure, Wave 1, disjoint files) shipped
2026-06-06 + code-review fix (commit `4065580b`). Verified in the codebase
(095-VERIFICATION.md, status human_needed, 4/4 must-haves, zero net-new test
failures, `tsc -b` = 37 baseline, backend 19/19, frontend 497 passed). The
diagnostic history (workflow wf_a263d71a-919) is retained below for audit; each
maps to a shipped fix.

### BUG-FOLD-ALL → CLOSED by 095-06 (re-test #2)
Per-step `expandedSteps` Set keyed on `stepKeyOf` replaces the shared
`stepsCollapsed` boolean; one click expands only that card; per-row re-collapse
("Hide") added. 12/12 ToolCallPanel tests green (incl. 5 new per-step cases).

### BUG-HERO-LEAK → CLOSED by 095-09 (re-test #3)
`_select_hero_filenames` returns exactly ONE hero on every branch (shared
`_hero_pick` max-size/iteration tie-break); one canonical `_hero_set` computed
over the COMPLETE set drives both the live emit and the post-loop persist
re-stamp, so live == reload. Token-match ext detection hardening added. 19/19
backend tests green (incl. `test_multi_cell_live_equals_reload_single_hero`).

### DESIGN-DIVERGENCE → CLOSED by 095-06/07/08 (re-test #2, #5)
All HIGH/MED/LOW diagnosed items shipped (essence line, un-gate, bloom, pill
chrome, single verb, `turn N` run-sub, icon sizes, soft halo, top-rule/eyebrow,
intermediates copy, chip order). SEED-054 defers per-file subtitle + SVG icon
(data-contract gap + explicitly-permitted icon form).

### WR-01 (code review) → CLOSED by commit 4065580b (re-test #2)
Plan 07's header-pill chrome double-framed Plan 08's embedded floating chip. Fixed
with a `header-bare` placement variant (plain segments, no nested pill); the
floating chip now renders a single pill. RunCard/MessageList suites 37/37 green.

WR-03 (StreamsProvider out-of-order `sub_agent_start` arg-drop) remains a
watch-item (re-test #1), not operator-reproduced.

**Next:** operator runs the live Chrome-DevTools-MCP re-UAT (the 5 scenarios
above) across the 6 native providers. If all pass → `/gsd:verify-work 095` records
PASS and the phase closes. If any felt-experience defect remains → a further
gap-closure cycle.
