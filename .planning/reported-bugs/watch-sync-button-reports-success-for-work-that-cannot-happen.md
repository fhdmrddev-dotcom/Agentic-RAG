---
id: BUG-260906-02
title: The watch Sync button reports "scheduled" for work nothing consumes, and says the same thing when the loop is off
reported: 2026-09-06
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/connectors, frontend/library, connectors/watches]
folded_into: 235
verified_closed_by: >
  Phase 235, all THREE named parts, each verified in code at the phase's final commit rather than
  assumed from a summary:
  (1) REFUSE — `backend/app/api/sources.py:379-392` (plan 235-07). ⭐ It is BETTER than the fix
      shape asked for: it tests the LIVE reader (`getattr(request.app.state, "watch_service", None)`)
      rather than `settings.watch_process_enabled`, because `main.py` swallows a failed start and
      leaves the flag reading true — the flag is not the fact. It returns `status="refused"` and
      WRITES NOTHING; poking a column no process reads is the false promise itself.
  (2) REPORT THE OUTCOME — `WatchedFoldersSection.tsx` renders `last_run_at` / `last_status`
      (7 references measured) as an outcome line and a stopped sentence (plan 235-10), with the
      cause as a NAMED value from `failure_cause.py`, never `last_error` prose.
  (3) SAY IT WAS ASKED — the endpoint answers `status="asked"` with `next_check_within_seconds`,
      and the card holds a `pendingAsks` state (plan 235-07 + 235-10). ⭐ D-235-16: the pending
      state clears only when `last_run_at` has advanced PAST the click, never on a timer — a
      self-expiring pending state would have been a second overclaim.
related_seeds: [SEED-248]
re_open_trigger: >
  ⚠ ONE THING THIS BUG'S CLOSURE DOES NOT COVER, named so the closure cannot be over-read:
  `release_watch` SWALLOWS its `connector_sync_runs` INSERT, so no test yet proves a run row is
  actually STORED after a real tick. The rendered outcome line is correct against the
  `connector_watches` columns this bug named, and those were always populated — but the run
  HISTORY behind it is unproven end-to-end. Re-open if a source shows an outcome line while its
  history stays empty. The first honest check is a non-zero `count(*)` on `connector_sync_runs`
  after a real tick, which is a G-4 row and not a unit test.
reproduces_on:
  branch: develop
  commit: da34aa8f7
  date: 2026-09-06
---

# BUG-260906-02: The Sync button reports success for work that cannot happen

## What we observed

The operator added a file to a watched Google Drive folder, clicked **Sync**, and waited. Nothing
appeared — then, or later. The UI reported the sync as accepted.

`POST /sources/watches/{id}/sync` (`backend/app/api/sources.py:262-296`) does **not** sync. It sets
a column and returns:

```python
UPDATE connector_watches SET next_run_at = now(), leased_until = NULL, updated_at = now() …
return WatchSyncResponse(status="scheduled", message=f"Watch {watch_id} scheduled for immediate sync.")
```

The actual read is performed by `WatchService._poll_loop`, which `main.py:570` starts **only** when
`settings.watch_process_enabled` is true. That setting defaults **`False`**
(`config.py:1203`; `WATCH_PROCESS_ENABLED=false` in `.env.example:326`). On the operator's machine it
was false, so **the row was updated and nothing on earth would ever read it.**

Measured before the flag was flipped — the watch had accepted a Sync click 27 minutes earlier:

```
next_run_at:  2026-09-05 23:22:25+00     <- the click
last_run_at:  None                       <- never ran, not once
last_status:  None
connector_watch_items: 0 rows
```

## Why it matters

**This is the defect that hid a blocking one.** Because the button reported success, the operator
reasonably concluded the watch loop was working and the *file* was the problem. The real cause — a
process-level feature flag defaulting to off — stayed invisible for a day and was only found by
reading the database directly.

⚠ **The bug does not go away when the flag is on.** With the loop running, the click is still honest
only by accident: the read happens on the next tick, up to `watch_poll_interval_seconds` (60 s)
later, and the surface says nothing about having asked rather than done. A person who clicks Sync and
sees no file 5 seconds later learns nothing about whether to wait or to worry.

This is `SEED-248`'s sentence — *a surface that is still loading must say so* — applied to a surface
that is not loading at all.

## Hypothesized cause

Not a hypothesis. The endpoint is a scheduler poke by design (it is safe across multiple uvicorn
workers, which is correct), but **its response vocabulary describes the request, not the outcome**,
and no surface reads back `last_run_at` / `last_status` to close the loop. Both columns exist on
`connector_watches` and both were `None` the whole time.

## Surface classification

`Agentic-RAG` — this app. Routes normally.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 234 is closing.
- **Defer to future phase / milestone:** **Phase 235.** This is that phase's SC#2 almost verbatim —
  *"a source that stopped reading says that it stopped, says when it last succeeded, and offers one
  control that fixes it. It is never silently quiet."* A watch whose loop is disabled is precisely a
  source that is silently quiet, and the "one control" here is not Reconnect — it is telling the
  operator the reader is switched off.
- **Plant as seed:** n/a — `SEED-248` already covers the general form.
- **External — note only:** no

## The fix shape (three parts, all small)

1. **Refuse rather than accept.** If `watch_process_enabled` is false, the endpoint should say so
   — the watch cannot be synced, and the reason is configuration, not the folder.
2. **Report the outcome, not the request.** The watch card should render `last_run_at` /
   `last_status` / `last_error`, all three of which already exist and are already populated
   correctly. "Checked 4 minutes ago · 6 files" is the honest version of "scheduled".
3. **Say that it was asked.** Between click and tick the surface should show the pending state
   rather than nothing, per `SEED-248`.

⚠ **Do not "fix" this by making the endpoint sync inline.** The poke is deliberately safe across
workers; an inline sync in a request handler would hold a web worker for the length of a Drive
listing and re-open the concurrency problem `claim_due_watches` was built to solve.

## Workarounds

Set `WATCH_PROCESS_ENABLED=true` in `backend/.env` and restart the backend — this is required for
the watch feature to function at all, and is not documented anywhere the operator would look. After
that, wait up to 60 s after clicking Sync.

## Reference / evidence links

- `backend/app/api/sources.py:262-296` — the endpoint
- `backend/app/main.py:570` — the flag gate on `WatchService.start()`
- `backend/app/config.py:1203` — `watch_process_enabled: bool = False`
- `.planning/phases/234-the-watch-loop-the-library-reads-by-itself/234-VERIFICATION.md` — the
  SC-blocking finding and the re-drive
- `SEED-248` — a surface that is still loading must say so
