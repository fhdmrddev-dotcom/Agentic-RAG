---
id: BUG-261020-04
title: "Check citations" does not appear on a freshly finished answer until the thread is re-opened
reported: 2026-10-20
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [frontend/streaming, frontend/chat, citations]
folded_into: "294"
verified_closed_by: "live drive 2026-10-20 (fresh answer showed Check citations · Jev without re-opening; the check reached the stored message)"
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

## Fix (2026-10-20, operator asked to continue autonomously)

Neither fix direction above was taken, because both touch `StreamsProvider.tsx` (G-5). Instead a new hook, `frontend/src/components/chat/usePersistedMessageId.ts`, resolves the stored id of a finished `temp-` answer by run id from `GET /threads/{id}/messages`: once per run, never while streaming, never for a temp row without a run id, and `undefined` (action hidden) when no twin is found or the request fails. `MessageItem.tsx` calls it once and both citation mounts read the result (+5 −2). Stored rows keep the old rule exactly.

- RED → GREEN: `usePersistedMessageId.test.ts` (8 cases) failed before the hook existed.
- Fences updated in the same commit: `CitedMarkdown.verdict.test.tsx` (it pinned the old guard, which was the defect) and `MessageItem.transcriptEvent.test.tsx` (hook count 7 → 8).
- `src/components/chat`: 80 files, 1046 tests, 0 failed. Typecheck clean on both source files.
- Live: a new chat with Jev on showed "Check citations · Jev" as soon as the answer finished. Clicking it returned the server's "This answer has no cited passages to check." for that answer, which proves the request carried a stored message id.

## Seen during the drive, not this bug

That answer carried no `[n]` markers at all: DeepSeek v4 flash named its sources in prose ("FMrad_FT_Approved_06062026.docx — Section 3.4"). An earlier answer in the same session had 13 markers. Marker emission varies by answer; the "Unmarked claims read as general knowledge" hint renders as designed.
