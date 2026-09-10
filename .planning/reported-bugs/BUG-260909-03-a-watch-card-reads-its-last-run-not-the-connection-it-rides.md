---
id: BUG-260909-03
title: A watched-folder card reports its LAST RUN, not the connection it rides — so it says READING on a switched-off connection and STOPPED on a working one
reported: 2026-09-09
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/sources, backend/watches]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 36cb1276b
  date: 2026-09-09
---

# BUG-260909-03: A watch card reads its last run, not the connection it rides

## What we observed

Driven live during Phase 240 UAT rows M-4 and M-5, on the operator's real Google account.

**Direction 1 — it claims to be reading when it cannot be.** With the Google Workspace connection
switched OFF at 19:33, the Watched Folders list showed:

| Row | Badge | Truth |
|---|---|---|
| INBOX | ⊙ **STOPPED** + *"the connection … is switched off"* | correct — it had run at 19:34 and been refused |
| CV | ● **READING** | ⛔ wrong — same connection, equally unable to read |

CV's last run was 19:21, **twelve minutes before the disable**, so its `last_status` was still
`success`. Both rows ride connection `5deb27f0`. Two rows, one connection, opposite claims,
on the same screen at the same moment.

**Direction 2 — it claims to be stopped when it is working.** The connection was re-enabled at
19:37. At 19:43 a sync ran and **succeeded** (`status: success`, `count_missing: 1`,
`listing_complete: true`). The card still read ⊙ **STOPPED** with *"The connection to Google
Workspace is switched off — reading resumes when it is switched back on"*, and still offered
"Turn Google Workspace back on" for a connection that was already on.

## Why it matters

The whole point of the Phase 235 surface is that a source says what it did. A row that derives its
state from the last run is silent for the entire interval between runs — **up to 30 minutes on the
default schedule** — and during that window it states the opposite of the truth in both
directions. A person acting on "READING" believes new mail is arriving when nothing can arrive;
a person acting on "STOPPED" re-enables a connection that was never off.

⚠ It also makes the fix action wrong: the card offered a remedy for a condition that had already
been remedied.

## Hypothesized cause

The badge and the stopped-card sentence are computed from `connector_watches.last_status` /
`last_error` (with `classifySourceFailure`), which describe **the last run that happened**. The
connection's own `is_enabled` is not an input to that computation, and nothing invalidates a
watch's rendered state when the connection under it changes.

Hypothesis, not verified: the fix is to treat `is_enabled = false` as a state the row derives
directly — a connection that is off means every watch on it is stopped, now, regardless of when it
last ran — and conversely to stop asserting `connection_disabled` once the connection is back on.

## Surface classification

`Agentic-RAG` — this app's own Watched Folders surface.
