---
id: BUG-260909-06
title: "Turn Google Workspace back on navigates to the Connections page instead of turning it back on — a label written as a write that only travels"
reported: 2026-09-09
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [frontend/sources, frontend/settings]
folded_into: null
verified_closed_by: Phase 247
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 36cb1276b
  date: 2026-09-09
---

# BUG-260909-06: A fix action labelled as a write only navigates

## What we observed

During Phase 240 UAT row **M-4**, with the Google Workspace connection disabled, the stopped-watch
card offered a button reading **"Turn Google Workspace back on"**.

Clicking it navigated to Settings → Connections. The connection was **not** enabled: measured
immediately afterwards, `is_enabled` was still `false` with `updated_at` unchanged from the moment
of the original disable. It had to be re-enabled separately through the connection row's own menu.

## Why it matters

Navigating may well be the RIGHT behaviour — re-enabling a connection is a deliberate act and
arguably belongs on the connection itself rather than on a watch card. **What is wrong is the
promise.** The label is an imperative verb naming a state change; a person reads it as the button
that does the thing, clicks it, lands on another page, and cannot tell whether it worked.

⚠ This project already has a rule for exactly this in its own design vocabulary:
**consequence ≠ receipt**. A control must say what it will actually do.

⭐ Worth fixing in the direction of honesty rather than power: *"Open Google Workspace settings"*
costs nothing and is true. Making the button perform the enable is the other option and a bigger
decision — it puts a connection-wide state change behind a per-watch control, and one connection
can carry several watches.

## Hypothesized cause

The card's fix action is wired to a navigation handler while its copy was written for a mutation.
Hypothesis, not verified.

## Surface classification

`Agentic-RAG` — this app's Watched Folders surface.
