---
id: BUG-261020-04
title: "Check citations" does not appear on a freshly finished answer until the thread is re-opened
reported: 2026-10-20
surface: Agentic-RAG
severity: minor
status: deferred
affected_areas: [frontend/streaming, frontend/chat, citations]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-365]
re_open_trigger: "Any phase touching frontend/src/providers/StreamsProvider.tsx, frontend/src/lib/dedupMessages.ts, or the run completion event; or the operator reports the missing button after an answer"
reproduces_on:
  branch: develop
  commit: 84dbfc755
  date: 2026-10-20
---

# BUG-261020-04: "Check citations" does not appear on a freshly finished answer until the thread is re-opened

## What we observed

Phase 294 drive pass 2 (`294-VALIDATION.md`), local app, reranking ON with Jev:

1. Ask a knowledge-base question; the answer finishes with "References · 10 sources".
2. Expected (D-13): "Check citations · Jev" beside the References trigger as soon as the answer has settled.
3. Actual: the header holds only the fold trigger, and no `GET /citation-checks` is sent.
4. Re-open the thread (or reload): the action renders, and the check runs end to end.

## Why it matters

The user sees the feature only after navigating away and back, so it reads as missing exactly when they want to verify the answer they just got.

## Hypothesized cause

A finished live answer keeps its optimistic `temp-…` id until its persisted twin replaces it (`frontend/src/lib/dedupMessages.ts`; id minted at `frontend/src/providers/StreamsProvider.tsx:390`). `frontend/src/components/chat/MessageItem.tsx:742` and `:778` deliberately withhold `checkMessageId` from `temp-` ids, because the check route needs the stored message id. The run's completion carries no persisted message id that could be swapped in, so nothing changes until the thread's messages are refetched.

## Fix direction

Either carry the persisted assistant message id on the completion event and swap it into the live row, or have the chat refetch the thread's messages once a run completes. Both touch the streaming path (`StreamsProvider.tsx`, a G-5 FIRING hot file), which is why 294 deferred it.
