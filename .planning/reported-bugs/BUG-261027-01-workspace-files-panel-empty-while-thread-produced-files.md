---
id: BUG-261027-01
title: The Workspace panel reads FILES 0 · No files yet in a thread whose two turns produced files
reported: 2026-10-27
surface: Agentic-RAG
severity: minor
status: open
affected_areas: ['frontend/panel', 'frontend/workspace']
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: "Fold at the next /gsd:discuss-phase whose files touch frontend/panel; found during the 296 G-4 drive, outside 296's inventory"
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
