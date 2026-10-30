---
id: BUG-261027-03
title: A schedule row shows the raw status word launch_failed, and Run now replaces the whole list with Loading…
reported: 2026-10-27
surface: Agentic-RAG
severity: minor
status: folded  # 2026-10-29: folded into Phase 300 at discuss-phase (300-CONTEXT.md)
affected_areas: ['frontend/workflows', 'workflow/schedules']
folded_into: "300, 302"
verified_closed_by: null
related_seeds: []
re_open_trigger: "Fold at the next /gsd:discuss-phase whose files touch frontend/workflows; found during the 296 G-4 drive, outside 296's inventory"
status_note: >
  2026-10-30 (302 REG-08): stays folded; folded_into widened "300" -> "300, 302". The row words and the
  row-local Run now shipped in 300-01 and PASSED live (300 G4-5, 2026-10-29, 300-HUMAN-UAT.md). Its one
  finding, F-1 (the refusal sentence shown twice right after Run now), is fixed in code by 302-03 (RED
  dd9610797, fix 993948b65). NOT closed: it closes when 302 G4-2 re-drives the five UI-SPEC S2 checks plus
  F-1 (302-VALIDATION.md), with verified_closed_by "300 G4-5 PASS 2026-10-29 + 302 G4-2".
  Previous status line, verbatim: `status: folded  # 2026-10-29: folded into Phase 300 at discuss-phase (300-CONTEXT.md)`.
reproduces_on:
  branch: develop
  commit: 01546a07d
  date: 2026-10-27
---

# BUG-261027-03: A schedule row shows the raw status word launch_failed, and Run now replaces the whole list with Loading…

## What we observed

Schedules dialog for `293 board: deepseek`: the `293 weekly check` row read `Last ran: 26/10/2026, 17:50:10 · launch_failed` (a wire value). Pressing Run now swapped the whole Existing schedules list for `Loading…` instead of a spinner on the pressed row (296 G-4 scenario 5, which still PASSED: the result line landed on the row).

## Why it matters

Raw status words break the words-first rule; the whole-list reload hides which row is busy.

## Hypothesized cause

Hypothesis: the row renders `last_outcome` verbatim; Run now refetches the list rather than marking one row busy. (hypothesis, not verified)

## Surface classification

Agentic-RAG: this app's own UI.
