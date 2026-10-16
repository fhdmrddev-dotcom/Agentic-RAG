---
id: BUG-261014-02
title: A watched file whose download fails once is never retried, and the next sync reports a clean success
reported: 2026-10-14
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/connectors, backend/ingestion]
folded_into: "285"
verified_closed_by: "285 (9e9af4a1e — 285-LIVE-EVIDENCE.md SC#1 + SC#5, 105/105 live 2026-10-16)"
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 8f7a02d30
  date: 2026-10-14
---

# BUG-261014-02: A watched file whose download fails once is never retried, and the next sync reports a clean success

## What we observed

Found during Phase 280 plan 04's live OneDrive re-drive (SC#2). The evidence is in
`.planning/phases/280-in-once-out-clean/280-LIVE-EVIDENCE.md` § SC#2.

1. Watch A on the real OneDrive folder `/Team Docs` (95 files, shipped config: page_size 30,
   non-recursive) ran one `WatchService.sync_watch`. The listing completed: 4 `list_files` calls,
   pages of 29 + 30 + 30 + 6 = 95 files, `listing_complete = true`.
2. The download of ONE file, `team-note-058.txt`, failed inside `adapter.read_file` with an
   empty-message `httpx.ConnectError` raised during the TLS handshake (`start_tls`). That is a
   transient network failure. The other 94 downloads succeeded.
3. The run row reads `status = success`, `count_new = 94`, `count_errors = 1`, `last_error = NULL`.
   The `connector_watch_items` row for the file reads `state = 'failed'`, `document_id = NULL`,
   `last_error = ''` (the exception's message is empty).
4. A SECOND sync of the same watch (deliberate, measured) listed all 95 files again and called
   `read_file` **zero** times. Its run row reads `status = success`, `count_new = 0`,
   `count_errors = 0`. The file is still not in the Library, and nothing will import it.

Expected: a transient download failure is retried on the next sync, or at least stays visible.
Actual: the file is permanently skipped, and from the second run on the history shows only clean
successes.

## Why it matters

This is the same family as BUG-260910-04: a source connected once and then trusted silently holds
fewer files than the folder. It is quieter than the truncation that bug fixed, because the first run
does count the error and every later run hides it. One dropped TLS handshake loses a file from the
corpus for good, and the user is never told which file. The recorded error text is empty, so even
the item row does not say why.

## Hypothesized cause

Hypothesis, from reading `backend/app/services/watch_service.py` `sync_watch` at `8f7a02d30`
(the second sync confirms the behaviour, not the exact line):

- The error arm (`except Exception as item_err`) upserts the watch item with `state='failed'` and
  `source_version = item.modified_at`.
- On the next sync the item is "existing", so it takes the EXISTING FILE branch. That branch only
  acts on `state in ('missing','unauthorized')` (restore), a changed version (modify), or a changed
  name (rename). A `failed` item with an unchanged version and name matches none of them, so it is
  never read again.
- `last_error=str(item_err)` stores `''` for an exception with no message; the exception type is
  lost.

## Surface classification

`Agentic-RAG`: the app's connector watch loop.

## Suggested routing

- **Fold into in-flight phase:** n/a. Phase 280 is closing and this is a new capability decision
  (retry policy), not a defect in 280's own code.
- **Defer to future phase / milestone:** the next phase touching `watch_service.py` or connector
  reliability.
- **Plant as seed:** no.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

Change the file at the source (edit and save it) so its version changes; the modify branch then
reads it. Or delete the watch item row so the next sync treats the file as new.

## Reference / evidence links

- `.planning/phases/280-in-once-out-clean/280-LIVE-EVIDENCE.md` § SC#2 (watch A id
  `0aa5c6ac-062a-4ff6-9a63-4acfed09a5d6`, both run rows, item row).
- Drive logs kept outside the repo: `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-280/drive_onedrive.log`,
  `resync_a.log`.

## Closed 2026-10-16 (Phase 285)

Closed by Phase 285 plan 01 (`9e9af4a1e`, FIX-12): a `failed` watch item is read again on later syncs (cap 3, reset on a source version change), its `last_error` keeps the exception type, and the run row names every still-failed file while `connector_watches.last_error` stays NULL.

Verified live twice. **SC#1:** `test_285_watch_retry_live.py`, RED first, then green. **SC#5:** the real OneDrive re-drive of watch A on 2026-10-16, with the operator's explicit OK ("option-a"). `team-note-058.txt` was retried and landed, `completed`, so A 95 + B 10 = **105 / 105**. A forced empty-message `httpx.ConnectError` on a temporary watch first read `state='failed'`, `failed_attempts 1`, `last_error 'ConnectError'`, with the run row `'1 file failed: q3-plan-01.txt (ConnectError)'`, and landed on the next sync. Evidence: `.planning/phases/285-watch-and-re-upload-close-out/285-LIVE-EVIDENCE.md` § SC#1, § SC#5.
