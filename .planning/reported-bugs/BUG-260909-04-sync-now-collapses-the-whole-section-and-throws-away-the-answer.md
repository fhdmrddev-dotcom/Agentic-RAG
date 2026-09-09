---
id: BUG-260909-04
title: "Sync now collapses the entire Watched Folders section into a loading state, so the outcome it produces is drawn and then thrown away before it can be read"
reported: 2026-09-09
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/sources]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 36cb1276b
  date: 2026-09-09
---

# BUG-260909-04: "Sync now" collapses the section it is reporting into

## What we observed

⚠ **REPORTED BY THE OPERATOR TWICE BEFORE IT WAS REPRODUCED**, in their words: *"when I clicked
sync now it is folding it again"* and, earlier, *"I clicked sync now nothing happened"*. Both were
correct, and the second is the more important one: **the sync had worked.**

Reproduced in the browser on 2026-09-09. Clicking **Sync now** on the INBOX row replaces the whole
Watched Folders panel with a single line — *"Loading watched folders…"* — and **every row
disappears**. After the refetch the rows return, re-rendered from scratch and collapsed.

The backend behaved perfectly throughout. On the M-4 run:

```
status: paused · failure_cause: connection_disabled · "Connection is disabled"
started 19:34:40.387 → finished 19:34:40.406      (19 ms)
```

The answer existed 19 milliseconds after the click. The screen threw it away.

## Why it matters

**This is the defect that made a correct refusal look like a dead button**, and it cost real time:
the operator reported "nothing happened", and the natural reading was that Sync now was broken, or
that the disabled-connection path hung. Neither was true. The engine was right, the copy was
right, and the presentation discarded both.

⚠ It compounds `BUG-260909-03`: after the refetch the row renders from `last_status`, so the one
moment a person is most likely to be looking — right after asking for a sync — is the moment the
card is most likely to be showing stale state.

⭐ **The general lesson outlives the fix:** a control that reports an outcome must not destroy the
surface that shows it. A row-level action deserves a row-level loading state.

## Hypothesized cause

`WatchedFoldersSection` refetches the whole watch list after a sync request and renders a
section-wide loading branch while that list is pending, rather than marking the single requested
row as in-flight. The per-row machinery already exists — the component tracks *"the instant Sync
now was asked, cleared when that watch's tick lands"* — so the section-wide loading branch is what
erases it.

Hypothesis, not verified.

## Surface classification

`Agentic-RAG` — this app's Library → Ingestion → Watched Folders surface.
