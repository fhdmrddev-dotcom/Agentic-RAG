---
status: partial
phase: 095-chat-tool-card-unification
source: [095-VERIFICATION.md, 095-VALIDATION.md, 095-REVIEW.md]
started: 2026-06-06T00:00:00Z
updated: 2026-06-06T13:00:00Z
re_uat:
  driver: claude-chrome-devtools-mcp
  provider_exercised: openai (gpt-5.4-mini), Deep mode
  date: 2026-06-06
---

## Current Test

[Claude-driven Chrome-MCP re-UAT complete on OpenAI/Deep. All 3 original gaps +
the WR-01 double-frame regression PASS. One NEW finding (reload timer inflation,
pre-existing) + one hero-choice nuance surfaced for operator decision. Cross-provider
breadth + parallel-thread + live floating-chip remain operator/limited.]

## Tests

### 1. Long run stays honest (timer + step-count + single sub-agent)
expected: timer visible+continuous full duration; step count equals between
timer/strip and panel; sub-agent appears exactly once.
result: PASS (live) — On a 10-step OpenAI/Deep run, the ⏱ timer rendered
continuously (9.3s → 44.3s …) and froze correctly at **1m 3s** at terminal; the
header pill "Step N", the title "Run · N steps", and the collapsed row all read the
SAME count (unifiedStepCount). NOTE (new finding, see Gaps): on RELOAD the same run
shows an INFLATED "8m 30s" (time-since-creation), not the true 1m 3s. Sub-agent
exactly-once was NOT exercised (no analyze_document sub-agent triggered in these
runs; covered by 095-03 unit tests).

### 2. Multi-tool run is calm (collapse + auto-scroll + jump-to-live)
expected: tool-cards in one frame; finished cards fold to a single essence line
(click-to-expand) from step 1; active card stays open + blooms; follow-but-release
scroll; floating "↓ Jump to live" chip is a single pill (no double-frame).
result: PASS — **Per-card fold (GAP-095-01) decisively fixed**: with 10 finished
steps all folded to essence lines, expanding ONE opened only that card (10 folded →
9 folded + 1 expanded); expanding a second → 8 folded + 2 expanded (independent
per-card state). The old shared-boolean bug would have opened all 10. Essence line
= `node · icon · name → result · DONE pill · chev` (sketch form). Active bloom =
`box-shadow inset 2px primary` + `bg primary/6%` (sketch-014). Un-gated fold (folds
from step 1) confirmed. Follow-but-release + floating chip: verified via unit tests
(useFollowScroll 7/7 + MessageList) + WR-01 fix in code/structural DOM (only ONE
run-status-strip ever rendered, header-bare variant) — the live ephemeral chip was
not captured via automated synthetic scroll (harness timing limitation, not a
product defect).

### 3. Hero file downloads — immediately AND next-day (reload honesty)
expected: one hero "★ Your file" card above collapsible Working files; download
works end-to-end; reload shows the SAME single hero (live == reload); multi-cell run
shows ONE hero.
result: PASS — A run producing a .docx + .csv + .png rendered **exactly ONE hero**
("★ YOUR FILE", 48px icon + soft glow halo + prominent Download) above
"Working files (2) — intermediates, all downloadable" (.CSV green + .DOCX blue,
30px). **Reload honesty (GAP-095-02 core fix) CONFIRMED**: after full page reload +
reopen, still exactly ONE hero — live == reload, no leak. Download works end-to-end
(in-app click → `/sandbox-outputs/...` 302 → Supabase signed URL → 200; verified for
PNG + CSV). NUANCE (operator decision, see Gaps): the hero is the largest file (the
PNG bar chart), not the .docx report.

### 4. Two threads + 6-provider parity (SC#10 4-axis)
result: PARTIAL — Only OpenAI/Deep exercised in this Claude-driven pass. The
gap-closure changes are provider-agnostic (frontend render + the shared agent_loop
hero function — no provider-specific code touched), so parity is expected by
construction, but other providers + the parallel-thread (Thread A streaming while
Thread B accepts a prompt) + long-message axes were not live-exercised. Operator to
confirm cross-provider + parallel-thread if desired.

### 5. Design fidelity vs the sketch contract (014/015/016)
result: PASS — Verified live + via DOM: header status strip = rounded-full PILL
(bg `rgba(20,25,36,.8)`, 1px border, vertical divider bars — not middots); single
activity verb (strip only, not doubled in title); `turn N` run-sub restored; active
bloom (inset 2px primary + 6% wash); finished-card essence line; hero icon 48 /
working 30; soft 24px hero halo; borderless "GENERATED FILES" top-rule + dim
uppercase eyebrow; "intermediates, all downloadable" copy; per-extension colored
file icons. SEED-054 deferrals (per-file subtitle + SVG icon) correctly absent.

## Summary

total: 5
passed: 3
partial: 2
issues: 0
pending: 0
skipped: 0

## Gaps

The 3 original operator gaps + the WR-01 code-review regression are CONFIRMED FIXED
(see Tests 2/3/5). The re-UAT surfaced no regression of the gap fixes. Two items
below are for operator decision; neither is a gap-closure failure.

### NEW-095-A (severity: minor–major, operator call): reloaded run timer is inflated
- **Observed:** a run that froze LIVE at `1m 3s` shows `8m 30s` after page reload +
  reopen (frozen, not ticking). The reloaded elapsed = (mount time − created_at),
  i.e. time-since-creation, NOT the true run duration. For a day-old run this reads
  like `~1440m` — exactly the original 095 "WR-01 timer" watch-item.
- **Root:** 095-02 D-06 derives elapsed from `Date.parse(created_at)` and freezes via
  `frozenEndRef` ONLY at the live streaming→terminal edge. On reload there is no such
  edge and no persisted run-end timestamp, so it computes against `now` at mount.
- **Scope:** PRE-EXISTING (095-02), NOT introduced by gap plans 06-09 (095-07 left the
  D-06 timer untouched by design). Out of the gap-closure scope.
- **Fix direction:** persist the run end time (or duration) and compute
  `elapsed = endAt − createdAt` on reload so a reopened run shows its true duration.
- **Routing:** operator decision — log as a new bug / SEED for a small follow-up, or
  fold into a follow-on gap cycle.

### NEW-095-B (nuance, operator call): hero = largest file, not the titled deliverable
- **Observed:** when the user asked for CSV + PNG + a Word .docx report, the single
  hero was the PNG bar chart (114 KB, largest), while the .docx report sat in Working
  files. Single-hero (no leak) is correct; the CHOICE is the question.
- **Root:** the `_select_hero_filenames` heuristic picks requested-ext → max size. The
  "agent declares the hero" branch is built but not wired to a live producer (deferred
  in 095-05). With no declaration, largest-file wins.
- **Routing:** operator decision — accept "largest file = hero", or prioritize wiring
  the agent-declared-hero path (or a deliverable-type ranking, e.g. docx/pptx/pdf >
  png/csv) so the titled report is crowned.

### Not live-exercised (lower priority / harness-limited)
- Live floating "↓ Jump to live" chip (verified in code + unit tests + structural DOM).
- Sub-agent exactly-once (no analyze_document run triggered; covered by 095-03 tests).
- Cross-provider breadth beyond OpenAI; parallel-thread isolation; long-message axis.

### Resolution routing (2026-06-06 — folded into Phase 095.1)

Both operator-decision items above were formalized into **Phase 095.1**
(cross-provider-run-honesty-workspace-parity) and IMPLEMENTED:
- **NEW-095-A** (inflated reload timer) → **095.1-03 D-05** persists run start/end and
  derives `elapsed = completedAt − startedAt` (identical live and on reload; a finished
  run with no `completedAt` shows NO duration). Closes BUG-260606-02.
- **NEW-095-B** (hero = largest file, not the titled deliverable) → **095.1-05 D-06**
  removed the hero concept entirely (flat equal "Generated files" list, all downloadable),
  so "which file is crowned" is moot. The backend `is_hero` flag stays written-but-unread.

Status: code shipped (Phase 095.1 all 5 plans, 2026-06-06); **awaiting live confirmation
via `/gsd:verify-work 095.1`** (8-provider lived-experience UAT). Not flipped to a final
PASS here — that closure is owned by the 095.1 verify-work loop.
