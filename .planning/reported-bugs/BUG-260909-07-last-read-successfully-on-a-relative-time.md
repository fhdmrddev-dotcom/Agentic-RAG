---
id: BUG-260909-07
title: "Last read successfully on 8 min ago — a preposition for an absolute date used with a relative one"
reported: 2026-09-09
surface: Agentic-RAG
severity: info
status: closed
affected_areas: [frontend/sources]
folded_into: null
verified_closed_by: Phase 247
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 36cb1276b
  date: 2026-09-09
---

# BUG-260909-07: "Last read successfully on 8 min ago"

## What we observed

On the stopped-watch card during Phase 240 UAT row M-4:

```
Last read successfully on 8 min ago
```

## Why it matters

Cosmetic, and recorded only because this surface's copy is otherwise carefully written, and this
line sits in a place people read when something has already gone wrong — where a visible slip
costs more confidence than it would elsewhere.

The likely cause is one sentence serving two time formats: *"on 3 September"* is correct,
*"on 8 min ago"* is not. Whatever composes the phrase needs to know which of the two it was
handed — or drop the preposition, since *"Last read successfully 8 min ago"* and *"Last read
successfully 3 September"* both read correctly without it.

## Surface classification

`Agentic-RAG` — this app's Watched Folders copy.
