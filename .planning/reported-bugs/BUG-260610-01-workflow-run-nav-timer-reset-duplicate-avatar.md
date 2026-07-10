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
re_open_trigger: "Reviewed at /gsd:discuss-phase 124 (2026-06-26) — left OPEN, NOT folded: live-run timer/reconcile mechanics, not the soul/door chrome Phase 124 re-skins. Re-check after the 124 run-header soul re-skin lands — if the soul header touches the run strip, this timer-reseed + duplicate-avatar bug may then be in-scope to fix. | Reviewed at /gsd:discuss-phase 128 (2026-06-27) — CONDITIONAL fold (CONTEXT D-04): CTC-03 makes the header RunStatusStrip the SOLE timer, so the timer-reseed fix (seed elapsed from run started_at, not mount) is folded into 128 ONLY IF the planner confirms the reseed is in that same canonical Deep RunStatusStrip (vs the 095.1-fixed Deep run-card, vs the harness/workflow strip = Phase 127's surface); else leave open. The duplicate-avatar symptom (StreamsProvider/MessageList double-mount race) is NOT folded — deferred to the run-honesty cluster slot. Stays OPEN."
reproduces_on:
  branch: develop
  commit: 66dca2d8
  date: 2026-06-22
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

## Update — reproduced + DB-confirmed render-only during Phase 102 UAT (2026-06-13)

Re-observed during Phase 102 freshness `ask_user` live UAT (DeepSeek `deepseek-v4-flash`, workflow `fresh-pause-102uat`):
- **At KICKOFF (flow start), not just on nav:** an orphan empty assistant avatar (no content) appears, and is sometimes **duplicated at start — one orphan avatar + one showing "starting workflow"**. This pins a second trigger beyond nav-back: the run-kickoff optimistic placeholder + the first SSE event double-mount (the S3 MessageList key-mismatch / S4 optimistic+reconcile-race seams).
- **CONFIRMED render-only (not a data dup):** the backend has exactly **1 assistant message row** per run (`messages` where role='assistant' = 1 for both the Proceed run ccec4354 and the Abort run 146a3bc2). The duplicate/orphan is purely a frontend render artifact — no duplicated message, no data loss. The freshness pause itself worked correctly (Proceed → completed + `validator_ask_user_approved` receipt; Abort → honest fail).
- **NOT a Phase 102 regression:** Phase 102 changed zero frontend files (all fixes were backend: publish_service / forced_emit / validator_kinds). This is the same pre-existing chat-surface bug; DeepSeek's first-token latency amplifies the empty-avatar window.

## Update — reproduced at KICKOFF on a FAST provider during Phase 121 demo (2026-06-22, HEAD 66dca2d8 / develop)

Re-observed live while demoing the Phase 121 2-pill composer: launched the published `Doc Q&A` workflow from the Workflows page into a fresh thread (OpenAI `gpt-5.4-mini`, the operator's default — **a fast provider**, not the slow OpenRouter/Moonshot/DeepSeek/Google runs all prior evidence came from).

- **At KICKOFF, the duplicated empty assistant avatar flashed for ~1–2 s, then reconciled away** once the first content arrived. Operator-observed in real time; the orchestrator's discrete a11y snapshots/screenshots only froze a single empty avatar (the transient double-mount is too brief to reliably catch in a point-in-time capture — noting this so future repro attempts use video/rapid frames, not single snapshots).
- **New signal — provider speed is NOT a precondition:** all prior evidence (Google/OpenRouter/Moonshot/DeepSeek) framed the empty-avatar window as *amplified by slow first-token latency*. This repro on fast OpenAI `gpt-5.4-mini` shows the double-mount still fires even when first-token latency is low — consistent with the root cause being the **kickoff optimistic-placeholder + first-SSE-event double-mount race** (S3/S4 seams), with provider latency only widening the *visible* window, not causing it.
- **NOT a Phase 121 regression:** Phase 121 (IA-01, 2-pill composer removal) touched **zero** render-path files — `git diff 131584b6^..66dca2d8` over `MessageItem.tsx` / `MessageList.tsx` / `useMessages.ts` / `StreamsProvider.tsx` is empty (composer-only edits to `MessageInput.tsx` + `ChatArea.tsx`). The avatar double-mount path is untouched; this is the same pre-existing artifact. Phase 121 decision **D-07** had already routed this report to Phase 124 (kept open, in the SC#10 must-not-regress set, not folded into 121).
- **Sibling cluster confirmed same session:** the run timeline still rendered the placeholder phase slug **`phase-0`** ("Phase 1 of 3, phase-0, started") — i.e. `BUG-260609-04` reproduced alongside, reinforcing the "close the workflow-run-display cluster together" routing below.

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
