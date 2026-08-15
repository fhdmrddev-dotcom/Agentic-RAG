---
id: BUG-260815-04
title: While a workflow runs, the chat area keeps a duplicate assistant icon and stays stuck on "Starting workflow…"
reported: 2026-08-15
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/chat, frontend/streaming, workflow/run-surface]
folded_into: 194
verified_closed_by: null
related_seeds: []
re_open_trigger: "⚠ FOLDED AT /gsd:discuss-phase 194 (2026-08-16) — STATE.md had recorded the routing since 2026-08-15 but this frontmatter still read folded_into: null, which is why the routing was invisible to every audit that reads frontmatter. It blocks SC#1 directly: if the chat surface never leaves its pre-tools state a user cannot tell a run is running, let alone reach a Stop — and it may be what defeats stopThread's `runStatus === \"streaming\"` scan (StreamsProvider.tsx:2400-2416), which is how three of the four Stop mounts find their run id. ⚠⚠ THE STRING IS DELIBERATE AND BYTE-PINNED — DO NOT REWORD IT (toolMeta.ts:92, pinned by toolMeta.test.ts:30 as a D-14 decision). The defect is that the surface never ADVANCES out of the pre-tools condition while workflow_phases rows are being written throughout. The duplicate-assistant-icon symptom is kept SEPARATE and may have a different cause. Re-open if 194 closes only the banner-advance half."
reproduces_on:
  branch: develop
  commit: 1dc4d509
  date: 2026-08-15
---

# BUG-260815-04: Chat stays on "Starting workflow…" with a duplicate assistant icon for the whole run

## What the operator saw

> "when I opened the workflow while it is running, in chat area the duplicate assistant icon is
> still there and it's always just showing 'starting workflow' in the chat area."

Observed during the Phase 193.1 end-to-end run.

## Two symptoms, probably two causes — kept separate on purpose

**1. The banner never advances past "Starting workflow…".**

The string is real and located: `outerBannerLabel` in `frontend/src/lib/toolMeta.ts:92` returns
`"Starting workflow…"` when the thread is **harness-locked and pre-tools**
(`isHarness ? "Starting workflow…" : "Setting up agent…"`). It is pinned byte-exact by
`toolMeta.test.ts:30` as a D-14 decision, so **the string is correct and deliberate** — the defect
is that the surface **stays in the pre-tools state for the whole run** instead of advancing as
phases complete.

⚠ **So this is not a copy bug and must not be "fixed" by rewording the banner.** The question is
why the harness run's progress never moves the chat surface out of its pre-tools condition, when
`workflow_phases` rows are being written throughout.

**2. A duplicate assistant icon persists.**

Not root-caused. ⚠ There is prior art worth checking first rather than re-deriving:
`toolcallpanel-dedup-duplicates-tool-card.md` is an existing report about duplication on the
tool-card surface. **Check whether this is the same dedup path before opening a new investigation.**

## Why it matters

The run took minutes and produced a real document. For that entire time the chat surface said
*"Starting workflow…"* — i.e. **the product was working correctly and reporting that it had not
started.** An author with no other window open cannot distinguish that from a hang, and the
honest-progress principle this project applies elsewhere (never-vanishes run-status strip, run
honesty) is exactly what is missing here.

## Investigation starting points

- `frontend/src/lib/toolMeta.ts:75-92` — the pre-tools banner condition; what clears `isHarness`
  pre-tools state.
- Whether harness phase progress reaches the chat surface at all, or only the panel. Phase 094/103
  split the surfaces deliberately (**panel owns the phase spine, chat carries a thin receipt**) —
  the receipt may simply never update.
- `workflow_phases` rows are written per phase, so **the progress data exists**; this is likely a
  propagation/subscription gap, not missing state. **Verify rather than assume.**

## Related

- `BUG-260815-03` — the run surface's other gap, from the same session: history reachable from
  chat but not canvas. **Both are about the run surface not telling the whole truth over time.**
