---
id: BUG-260909-05
title: "missing_since is never written, so a file that vanished at source can be reported as missing but never as missing SINCE when"
reported: 2026-09-09
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [backend/watches]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 36cb1276b
  date: 2026-09-09
---

# BUG-260909-05: `missing_since` is never set

## What we observed

Driven live as Phase 240 UAT row **M-5**. A watched Gmail message was deleted at source; the next
sync detected it correctly, and everything else about the transition was right:

```
run:  status success · listing_complete true · count_missing 1
item: state 'missing' · missing_since NULL
doc:  status completed · source_state 'missing_at_source' · chunk still searchable
```

`connector_watch_items.missing_since` exists precisely to record **when** something disappeared,
and the transition that sets `state = 'missing'` does not write it.

## Why it matters

Low severity because nothing is lost or wrong — the detection, the document's survival and the
`missing_at_source` mark are all correct, and that is the part that matters.

But this column is the only place the answer to *"how long has this been gone?"* could come from,
and a surface cannot offer "missing since Tuesday" without it. It also blocks any future policy
that depends on age — a purge prompt after N days, or a distinction between "deleted a minute ago"
and "deleted last month" — and those are the natural next asks once people start noticing missing
files.

⚠ **It is invisible to every existing test**, because the tests assert the state transition and
nothing asserts the timestamp beside it.

## Hypothesized cause

`WatchService.sync_watch`'s deletion arm calls `update_item_state(..., state="missing")` and passes
no timestamp. The restore arm — *"re-appearance check: if previously missing/unauthorized, restore
to present"* — would also need to clear it, or a file that went missing, came back, and went
missing again would report the first disappearance rather than the current one.

Hypothesis, not verified.

## Surface classification

`Agentic-RAG` — this app's watch loop.
