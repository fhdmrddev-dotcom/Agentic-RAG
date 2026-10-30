---
id: BUG-261027-01
title: The Workspace panel reads FILES 0 · No files yet in a thread whose two turns produced files
reported: 2026-10-27
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: ['frontend/panel', 'frontend/workspace']
folded_into: "302"
verified_closed_by: null
related_seeds: []
re_open_trigger: "Fold at the next /gsd:discuss-phase whose files touch frontend/panel; found during the 296 G-4 drive, outside 296's inventory"
status_note: >
  2026-10-30 (302 REG-08): stays folded -> 302. Fixed IN CODE by 302-01 (0e9aaed94, 19d4589b5): read-side,
  the panel's FILES section now lists the thread's generated files from its own messages
  (useThreadMessages(threadId, "chat") -> deriveGeneratedFiles), with one count for the header, the rail and
  hasActivity. NOT closed: it closes when 302 G4-1 (repro thread 3586b900, 302-VALIDATION.md) passes in
  Chrome; verification then sets status closed + verified_closed_by. Previous status line: `status: folded`.
reproduces_on:
  branch: develop
  commit: 01546a07d
  date: 2026-10-27
---

# BUG-261027-01: The Workspace panel reads FILES 0 · No files yet in a thread whose two turns produced files

## What we observed

Thread `3586b900…` (Quarterly Revenue Three Charts PDF): both turns ran `execute_code` and returned `output_files` (c1-c3.png + quarterly-revenue-charts.pdf; the chat shows them as GENERATED FILES with sizes), but the right-hand Workspace panel's FILES section read `0` and `No files yet.` the whole time (G-4 scenario 8, `.planning/phases/296-close-v4-7-debt/evidence/g4/8-followup.jpg`).

## Why it matters

A person looking at the panel for the run's files sees none, while the chat column shows four.

## Hypothesized cause

Hypothesis: sandbox `output_files` are served from `/sandbox-outputs/…` and are not workspace files, so the panel's FILES list (workspace_files) never sees them; the two homes disagree. (hypothesis, not verified)

## Surface classification

Agentic-RAG: this app's own UI.
