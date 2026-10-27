---
id: BUG-261024-02
title: A draft the describe door generates is lost if the author leaves without editing it
reported: 2026-10-24
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [frontend/workflow-builder, workflows/drafts]
folded_into: "296"
verified_closed_by: "296"
related_seeds: []
re_open_trigger: null
fixed_by_commit: "296-07: RED 2548b6212, GREEN 02b5053ac (onDrafted calls persistence.saveNow(); mockCreate 0 -> 1)"
reproduces_on:
  branch: develop
  commit: ebad6afee
  date: 2026-10-24
---

# BUG-261024-02: A draft the describe door generates is lost if the author leaves without editing it

## What we observed

Found during the Phase 288 S1 re-drive (Chrome, local, 2026-10-24).

1. Workflows → Build a workflow → Draft it for me → describe → Write the first draft. A 2-step draft arrived in ~20 s.
2. Dismiss the arrival card (✕) without editing anything.
3. Click ← Workflows.

Expected: the generated draft is kept (it is the author's work in progress), or leaving warns first.
Actual: no draft row exists (`GET /workflows/drafts` has none), Build a workflow does not restore it, nothing in localStorage, and no warning was shown. The AI's output is gone.

With any edit first (e.g. renaming in Draft settings), autosave fires (`Saved · still a draft`) and the draft survives a library round trip and a hard reload — so Phase 288's S1 (D-14: generate → rename → dismiss → leave) passes as written.

## Why it matters

The author paid a model call and waited for a draft; leaving loses it silently. Phase 288's goal is "an author's work in progress does not disappear". Operator decision 2026-10-24: track as a follow-up.

## Likely fix

Persist the draft when generation succeeds (or on dismiss), or warn on navigate-away while an unsaved generated draft is open.

## Closed 2026-10-27 (296)

Verified closed by G-4 optional row 10 in `.planning/phases/296-close-v4-7-debt/296-HUMAN-UAT.md` (PASS with evidence under `evidence/g4/`). Status was `folded`.
