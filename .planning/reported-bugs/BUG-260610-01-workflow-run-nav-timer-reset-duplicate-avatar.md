---
id: BUG-260610-01
title: Navigating away/back during a streaming workflow run resets the run timer and shows a duplicated empty assistant avatar
reported: 2026-06-10
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/streaming, frontend/run-honesty, harness/workflow-ui]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: d152dc83
  date: 2026-06-10
---

# BUG-260610-01: Workflow-run nav glitch — timer resets + duplicated empty assistant avatar

## What we observed

During Phase 099 live UAT (L3 Google row, gemini-3.5-flash, workflow `skill_compose_099uat`): with a workflow run streaming in Thread A, the operator navigated to another thread and back (repeatedly). Each time:

1. **The run-strip timer reset** — e.g., a run several minutes in showed `28s · Step 0 · working...` after nav-back; the elapsed timer reseeds from component mount instead of the run's `started_at`.
2. **A duplicated empty assistant avatar** rendered in the message list — one bare avatar with no content directly above the real streaming placeholder ("Starting workflow..."). Screenshot: `screenshots/Screenshot 2026-06-10 122214.png`.

The run itself completed correctly (output intact, phase completed, no data loss) — these are display-honesty defects only.

**Cross-provider confirmation:** the same two symptoms reproduced on the OpenRouter run (L4 row, same UAT session) — provider-agnostic frontend reconcile behavior, not a provider-specific path.

**Also reproduced on DeepSeek (L9 row)** — now confirmed on Google, OpenRouter, Moonshot, and DeepSeek runs: fully provider-agnostic.

**Related symptom (L8 row, Deep mode):** on slow providers (OpenRouter llama-3.3-70b, Moonshot kimi-k2.6) a blank assistant avatar renders with no placeholder text until the first tool call arrives, then the thread loads correctly (screenshot `Screenshot 2026-06-10 125236.png`). Same empty-bubble family in plain Deep mode — the placeholder gap scales with provider first-token latency.

**Worse variant (L6 row, kimi-k2.6/Moonshot, screenshot `Screenshot 2026-06-10 123038.png`):** TWO bare assistant avatars with NO "Setting up agent..."/"Starting workflow..." placeholder text at all — the streaming placeholder text vanished entirely on a slow-provider run, leaving only empty avatar shells. Timer reset reproduced across BOTH parallel threads (the Deep thread's tool panel stayed correct).

## Why it matters

The run timer is the operator's primary "is this stuck?" signal during long workflow runs; a timer that restarts on every navigation makes a 5-minute run look like it just started, defeating run honesty (Phase 094/095 design goals). The duplicate empty avatar reads as a broken/phantom message. Both erode trust in the live-execution surface, especially during slow provider runs (Google) where the operator is most likely to navigate away.

## Hypothesized cause

HYPOTHESIS (unverified): same family as the Phase 095 reload-timer finding (fixed in 095.1 for Deep run cards) — the workflow/harness run strip seeds its elapsed timer from local mount time instead of the run row's `started_at`/`created_at`, so a remount on thread nav restarts it. The duplicate avatar is likely the known 1-2s empty-bubble reconcile artifact (open since 098) surfacing persistently during workflow streaming: reconcile-on-nav inserts an empty assistant message shell alongside the streaming placeholder. Both are StreamsProvider/MessageList reconcile-on-remount paths, not backend issues (backend state was correct; run completed).

## Surface classification

`Agentic-RAG` — frontend chat-surface behavior of this app's workflow-mode run UI.

## Suggested routing

- **Fold into in-flight phase:** n/a (099 is functionally complete; this is not a skill-composition defect)
- **Defer to future phase / milestone:** candidate for the next chat-surface/run-honesty polish slot (alongside open BUG-260609-02 SUB-RESULTS desc loss, BUG-260609-04 phase-card placeholder slug, and the 1-2s empty-bubble — all four share the workflow-run display surface and could close together)
- **Plant as seed:** no — concrete bug, not a cross-milestone concern
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

Stay on the running thread for an accurate timer; the glitch is display-only — refreshing after run completion shows the correct final state. Run completion/output are unaffected.

## Reference / evidence links

- `screenshots/Screenshot 2026-06-10 122214.png` (duplicate avatar + reset timer at 28s mid-run)
- `screenshots/Screenshot 2026-06-10 122245.png` / `122304.png` (run completed correctly despite the glitch)
- Phase 099 UAT session: `.planning/phases/099-workflow-skill-composition/099-UAT.md` Test 3
- Prior family: 095 reload-timer (fixed 095.1 for Deep), 098 open run-honesty trio (BUG-260609-02 / BUG-260609-04 / 1-2s empty-bubble)
