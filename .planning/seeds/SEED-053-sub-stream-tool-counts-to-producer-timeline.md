---
id: SEED-053
title: Thread sub-agent tool/search events up to the harness producer stream — per-phase tool drill-down + honest "N searches / N tool calls" counts on the panel timeline (UI-SPEC Build Prerequisite B)
status: planted
planted: 2026-06-04
planted_by: orchestrator (/gsd:discuss-phase 094 — Area ③ count-honesty decision: ship honest subset, defer B)
trigger_when: Phase 094 panel timeline has shipped AND we want per-phase tool/search granularity, OR v2.9 kickoff, OR any phase that touches the sub-agent streaming path (task_service.py sub_run_id emits) or the harness producer event vocabulary.
priority: medium
tags: [harness, panel-timeline, sub-agent-stream, tool-counts, legibility, 094, v2.9, BUILD-PREREQ-B]
---

# SEED-053: Sub-stream tool/search events → producer timeline (Build-Prereq B)

## Context (how it surfaced)

`/gsd:discuss-phase 094` Area ③. The operator's verbatim #1 acceptance bar (from the 093 re-UAT)
included **"6 searches", "16 tool calls"** per phase. A grounded code investigation
(`wf_11628da0-038`) confirmed those counts fire **only on the sub-agent stream
(`run:{sub_run_id}`)**, never on the harness **producer stream (`run:{run_id}`)** the panel
timeline reads — so showing them honestly today is impossible (they'd be invented). Phase 094
therefore ships the **producer-honest subset** (agent count via `sub_agent_start` tally, phase
transitions, merge narration, per-subtopic `sub_agent_done.summary`, draft, failure-with-reason)
and **suppresses** per-phase tool/search counts. This seed captures the deferred plumbing that
would make the literal counts honest.

## The capability

Thread the sub-agent's internal `tool_start` / `tool_end` (and search/tool-call tallies) **up to
the harness producer stream**, so the panel phase-timeline can honestly show, per phase:
- "N searches", "N tool calls"
- a live **sub-agent tool drill-down** (what each sub-agent is doing inside a phase — the
  log-level granularity the operator watched during the re-UAT).

This is **UI-SPEC §Build Prerequisites B** (and the §Out-of-Scope "sub-agent live tool drill-down
+ per-phase counts"). It is the single biggest backend add for the timeline and touches the **hot
sub-agent streaming path** (`backend/app/services/task_service.py` — the `sub_run_id`-scoped
`dispatch_tool` emits at ~699–714), so it was deferred out of 094 deliberately.

## Why deferred (not in 094)

- It's backend plumbing on a hot, cross-provider streaming path — real regression risk to the
  sub-agent path Deep `task()` also rides.
- The 094 honest subset already meets the operator's *spirit* ("show the real steps, not a
  spinner"); the literal per-phase counts are the cherry on top.
- Doing it right (aggregate without double-counting, cross-provider, no producer-event-vocabulary
  breakage) deserves its own scoped plan.

## What it would take (sketch)

- A producer-visible per-phase tool/search tally (forward the sub-stream `tool_start`/`tool_end`
  to the producer with the owning `phase_index`, or aggregate at phase completion).
- Keep the producer event vocabulary additive (do not break the existing `phase_*` contract Phase
  094 renders).
- Cross-provider verification (tool-call shapes differ per provider/gateway calling_mode).
- Then un-suppress the count chips in the 094 timeline (the render guard already exists — counts
  stay hidden until a real producer source exists).

## Re-open trigger

094 timeline shipped + operator wants per-phase tool/search granularity, OR v2.9 kickoff, OR any
phase touching the sub-agent stream emits or the harness producer event vocabulary.
