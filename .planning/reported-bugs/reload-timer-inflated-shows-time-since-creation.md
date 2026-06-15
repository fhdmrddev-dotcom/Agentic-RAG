---
id: BUG-260606-02
title: Reloaded completed run shows inflated elapsed timer (time-since-creation, not true duration)
reported: 2026-06-06
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/run-card, frontend/timer]
folded_into: "095.1"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 4497ce06
  date: 2026-06-06
---

# BUG-260606-02: Reloaded run timer is inflated

## What we observed

A run that completed in ~1 minute and correctly froze LIVE at **"1m 3s"** showed
**"8m 30s"** after a full page reload + reopening the thread (Chrome-MCP, 2026-06-06).
The reloaded value is frozen (not ticking) but wrong — it equals time-since-the-message-
was-created, not the actual run duration. For a run reopened the next day this would read
like **"1440m"** — the exact "WR-01 timer" watch-item flagged in the original 095 UAT.

## Why it matters

Directly undermines run-honesty (the whole point of the run-status surface): the timer
lies about how long the agent actually worked. Cosmetic-but-trust-eroding; gets worse the
longer ago the run happened.

## Hypothesized cause

CONFIRMED (live + code). 095-02's D-06 timer derives elapsed from
`Date.parse(message.created_at)` and freezes via `frozenEndRef` ONLY at the live
streaming→terminal edge. On reload there is no such edge and no persisted run end-time,
so elapsed is computed against `now` at mount → time-since-creation. Pre-existing (095-02),
NOT introduced by the 095 gap plans (095-07 left the D-06 timer untouched by design).

## Surface classification

`Agentic-RAG` — frontend run-card timer. Cross-checked at discuss-phase.

## Suggested routing

- **Fold into in-flight phase:** 095.1 (run-honesty cluster)
- **Defer:** n/a
- **Plant as seed:** n/a
- **External — note only:** no

Fix direction: persist the run end-time (or duration) and compute
`elapsed = end − created` on reload so a reopened run always shows its true duration.

## Workarounds

None (cosmetic; the live value during the run is correct).

## Reference / evidence links

- RunCard D-06 timer (frozenEndRef / startMs); 095-02-SUMMARY.md
- [[project_095_cross_provider_uat_findings]]
