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

Operator live-UAT (2026-06-06) surfaced 3 issues. Diagnosed + adversarially
verified by workflow wf_a263d71a-919 (11 agents). Root causes below; fix scope
for the design items pending operator confirmation.

### BUG-FOLD-ALL (severity: high, confidence: high — CONFIRMED both adversarial lenses)
- **Root cause:** `ToolCallPanel.tsx:488` — a SINGLE shared `stepsCollapsed`
  boolean governs the in-flight "Focus Mode" done-step window. Every collapsed
  summary row's onClick (`:552`, `:570`) calls `setStepsCollapsed(false)`, so
  one click un-collapses ALL rows. No per-row identity exists. Only observable
  MID-RUN (≥3 done steps before the active tool); after a run ends the per-card
  `ToolResultBlock` state (`:148`) is correct, which is why it self-heals on
  reload.
- **Fix:** replace the boolean with a per-step `Set<string>` keyed on the same
  `stepKeyOf` clientKey identity; gate `:544` with `!expandedSteps.has(key)`;
  `:552`/`:570` add ONE key; add a per-row re-collapse affordance (the existing
  "Hide earlier steps" button only renders while `!stepsCollapsed`).
- **Caveat:** `ToolCallPanel.test.tsx:99-108` currently CODIFIES the expand-all
  behavior — must be updated + a partial-expand test added.
- **Files:** `frontend/src/components/chat/ToolCallPanel.tsx` (+ its test). Violates D-01 + SC#1.

### BUG-HERO-LEAK (severity: high, confidence: high — primary cause CONFIRMED)
- **Root cause:** `agent_loop.py:835-844` `_select_hero_filenames` returns a
  MULTI-element SET in the requested-extension branch — every file whose ext
  matches a requested ext is stamped `is_hero=True`. A run that writes the
  deliverable + same-type scratch files heroes them all. The frontend partition
  is CORRECT (faithfully renders `is_hero`, working = strict complement) — the
  leak is 100% backend over-selection. `test_095_final_output_tag.py:62-69`
  encodes the multi-hero behavior as intended.
- **Fix:** requested-ext branch returns exactly ONE filename via the same
  `max(size, iteration)` tie-break as the fallback; update the test to assert one
  hero.
- **Secondary (separate, narrower):** a live-vs-reload divergence exists only in
  the fallback "largest-file" branch on multi-cell runs (persist stamps per-cell
  over a partial list; live computes once over the full set). Fix = compute the
  hero set ONCE at loop end and apply to both emit + persisted rows (or re-derive
  on reload in `api.ts`). NOTE: the earlier "md matches made/summary" substring
  claim was a fabricated example caught by the skeptic — substring ext-detection
  hardening is legit defense-in-depth but NOT the symptom cause.
- **Files:** `backend/app/services/agent_loop.py` (+ test); optionally `frontend/src/lib/api.ts`. Touches SC#1 (no dup) + file-axis honesty. Confirms WR-02.

### DESIGN-DIVERGENCE (vs sketch contract 014/015/016) — confirmed, scope pending
Lots MATCHES (run-frame, sticky header, never-vanishes timer, rail node/snum,
unifiedStepCount single-source, dedup, hero/working structure, color map). The
confirmed divergences, ranked:
- HIGH — finished card shows args + a SEPARATE result row, not the sketch's
  single "essence line" (`snum · icon · name → result · pill · chev`). `ToolCallPanel.tsx:690-747` + `206-228`.
- HIGH — Focus-Mode fold gated at ≥3 steps; sketch un-gates so every finished
  step folds to its essence from step 1. `ToolCallPanel.tsx:486-488`.
- MED — active step doesn't "bloom" (sketch: primary-dim wash + inset 2px left
  bar; code: old 075.8 outer glow). `index.css:399-404`.
- MED — header status strip is bare middot text, missing the rounded-full pill
  chrome (bg/border/divider bars). `RunStatusStrip.tsx:44-51`.
- MED — activity verb rendered twice (title + strip); model·turn run-sub dropped. `RunCard.tsx:170-174`.
- MED — hero file icon 30px (sketch 48px); working 16px (sketch 30px). `OutputFileCard.tsx:82`.
- MED — hero glow is a flat 1px ring @8% (sketch: soft 24px primary halo). `OutputFileCard.tsx:165`.
- MED — output container is a bordered box (sketch: borderless top-rule + dim
  uppercase eyebrow; predates 095). `MessageItem.tsx:83-84`.
- LOW — floating chip leads with Jump-to-live then status (sketch: status first,
  jump trailing); working toggle missing "— intermediates, all downloadable";
  no descriptive subtitle (partly a data-contract gap — no description field on
  the wire); fileIcon is Lucide-glyph form (EXPLICITLY PERMITTED by the contract — not a required change).

WR-03 (StreamsProvider out-of-order sub_agent_start arg-drop) remains a
watch-item, not operator-reproduced.

**Recommended routing:** ONE gap-closure phase (`/gsd:plan-phase 095 --gaps`),
4 units: (1) ToolCallPanel essence-line + per-step collapse + un-gate + bloom;
(2) header chip chrome + single verb + run-sub; (3) file-axis visual fidelity
(icon sizes, glow, top-rule/eyebrow); (4) backend one-hero + test. Quick fixes
rejected — units 1-3 re-edit the same ToolCallPanel/MessageItem hot files, so one
plan + one cross-provider validation pass is cleaner.
