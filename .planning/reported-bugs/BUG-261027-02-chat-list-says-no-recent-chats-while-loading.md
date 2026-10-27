---
id: BUG-261027-02
title: The chat list shows No recent chats for several seconds on load, before 1,400+ threads arrive
reported: 2026-10-27
surface: Agentic-RAG
severity: minor
status: open
affected_areas: ['frontend/chat', 'frontend/layout']
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: "Fold at the next /gsd:discuss-phase whose files touch frontend/chat; found during the 296 G-4 drive, outside 296's inventory"
reproduces_on:
  branch: develop
  commit: 01546a07d
  date: 2026-10-27
---

# BUG-261027-02: The chat list shows No recent chats for several seconds on load, before 1,400+ threads arrive

## What we observed

Fresh page load as the dev user (1,418 threads): the Chats column read `No recent chats` for ~3-8 s, then filled in. Seen three times on 2026-10-27 (296 G-4 drive).

## Why it matters

An empty-state that says there is nothing, when the list is merely loading, reads as data loss for those seconds.

## Hypothesized cause

Hypothesis: the empty state renders on `threads.length === 0` without distinguishing loading from loaded-empty. (hypothesis, not verified)

## Surface classification

Agentic-RAG: this app's own UI.
