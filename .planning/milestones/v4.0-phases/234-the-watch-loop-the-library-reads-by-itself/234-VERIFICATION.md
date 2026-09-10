# Phase 234 — The Watch Loop: The Library Reads By Itself · VERIFICATION

**Verified:** 2026-09-06 · **Verifier:** Claude (reviewer) · **Builder:** Gemini
**Branch:** `develop` · **Tip at verification:** `da34aa8f7`
**Verdict: ✅ PASS — and for the first time DRIVEN, not read.**

---

## ⭐ The headline: a file arrived by itself, and it took an operator G-4 session to prove it

Every prior record of this phase — `234-SUMMARY.md`, `STATE.md`, `BUS-150` — reported PASS at the
**unit, wire and UI grain**. All of that was true and none of it had ever been run. The checkpoint
`.continue-here.md` said so plainly: *"nobody has watched a file arrive by itself."*

The operator ran it on 2026-09-06. **It did not work**, for a reason no unit test could have caught,
and then it did. Both halves are recorded below, because the failure is the more useful half.

---

## ⛔ SC-BLOCKING FINDING — the loop was never running, and the product said nothing

The operator added a file to a watched Drive folder, clicked **Sync**, waited, and nothing appeared.

**Measured against the live database, not inferred:**

```
connector_watches (1 row)
  source_folder_name: CV          last_run_at:   None
  interval_minutes:   30          last_status:   None
  is_active:          True        last_error:    None
  next_run_at:  2026-09-05 23:22:25+00   <- the Sync click, still unconsumed
  connector_watch_items:  0 rows
```

**`last_run_at = None` and 0 items: the watch had never run once.**

**Root cause:** `settings.watch_process_enabled` read **`False`** — the default Phase 234 shipped
(`config.py:1203`, `WATCH_PROCESS_ENABLED=false` in `.env.example:326` and
`deploy/onebox.env.example:267`). `main.py:570` gates the whole `WatchService` start on it. The
background loop that reads folders was not running in the operator's process and never had been.

⚠ **The five files the operator believed the watch had synced were NOT the watch.** They were
imported at **22:48** through the Phase 233 preview→confirm path; the watch was created at **22:55**,
seven minutes later. The phase had been credited with another path's work — which is exactly what a
G-4 row exists to catch and what no wire-grain test can.

### The fix, and the re-drive

`WATCH_PROCESS_ENABLED=true` in `backend/.env`, backend restarted. Re-measured:

```
  last_run_at:  2026-09-05 23:32:56+00     last_status: success
  next_run_at:  2026-09-06 00:02:56+00     last_error:  None
  connector_watch_items:  6 rows      <- was 0
```

**Item 1 is the operator's new file** — `Dubai DoF_Document Management and Archival System Project-
GCG_ Technical Proposal V1.0.pdf`, `source_version 2026-09-05T22:51:00Z`, `state=present`, minted
`document_id 8924f33b…`. ⭐ **A file arrived in the Library with nobody uploading it.**

---

## Success criteria

| SC | Verdict | Evidence |
|---|---|---|
| **SC#1** — a watched folder is read on a cadence without anyone uploading | ✅ **PASS (driven)** | `last_status=success`, `last_run_at` advanced, `next_run_at` = +30 min = the row's own `interval_minutes`. The new file was minted and enqueued by the loop alone. ⚠ Only after the flag fix above. |
| **SC#2** — per-watch and per-item error isolation (`SEED-239`) | ✅ PASS (unit) | `tick()` wraps each `sync_watch` in its own `except` and calls `release_watch(status="failed")`. Not exercised live — no watch failed. **Recorded as unexercised, not as passed.** |
| **SC#3** — disconnect/purge retains documents rather than deleting them (VIS-05) | ✅ PASS (unit) | 12/12 in `test_disconnect_freeze.py`. Not driven. |
| **SC#4** — rename/move/re-share updates in place, no duplicates, no re-ingest | ✅ **PASS (driven, and better than asked)** | The five files already imported by the 233 path were **linked, not re-imported**: `upsert_watch_item` matched tier-1 identity `(system, external_id, version)` and produced **0 duplicate documents and 0 new embeddings**. The dedup held across *two different ingest paths*, which the tests never covered. |
| **H-5 / SRC-06** — a non-complete listing may never mark a file missing | ✅ PASS (unit) | `SourceListing.complete` defaults `False`; set `True` only when pagination exhausts. Not driven — no listing failed. |

---

## Gates at verification

| Gate | Reading |
|---|---|
| backend `pytest tests/unit` | **72** failed / 3781 passed — ⚠ 1 over the stale 71 ceiling, **pre-existing** (BUS-117 class, present on the merge base before this phase) |
| frontend count gate | total **7544**, failed **1** — `WorkflowBuilderPage.canvas.test.tsx`, green 154/154 in isolation, named in Gemini's own pre-build baseline (SEED-171 class) |
| tsc | **68** = baseline |
| deploy drift · landing drift · CLAUDE.md size | all PASS |

Neither red is attributable to Phase 234; both were measured on the merge base first.

---

## ⚠ Four findings carried OUT of this phase, none of them a 234 defect

Folding these in would be a gap-closure round smuggling in new capability, which **G-7 forbids**.
Each is filed at its own home rather than left in prose here.

1. **`BUG-260906-01` — classification never runs on the queue ingest path.** Rule evaluation lives
   in `documents.py:2391`, inside `ingest_document` — the **legacy synchronous upload path**.
   `grep -n classification` across `ingest_enrich.py` + `ingestion_queue_service.py` returns one
   comment and nothing executable. **Every watched file is therefore ineligible for filing**, and
   the operator's new document carries `metadata._classification = None`. ⚠ **This is the FIFTH
   instance of the shape that caused all four bugs of the 2026-09-05 repair session** — two paths
   serving one outcome, only one doing the work. `ingest_enrich.py` exists to be the single home
   for that step; classification was never moved into it.
2. **`BUG-260906-02` — the Sync button reports success for work that cannot happen.**
   `POST /watches/{id}/sync` only sets `next_run_at = now()` and returns `status="scheduled"`. With
   the loop off it is consumed by nothing, and the UI says the same thing either way. **This is the
   defect that made the SC-blocking finding above invisible for a day.** It remains wrong with the
   flag ON — the person still learns nothing about a claim that takes up to 60 s to become true.
3. **`BUG-260906-03` — a completed document can have no `ingestion_jobs` row.** Of the five
   preview-imported files, **3 have a job and 2 have none**, yet all five are `completed` with
   chunks (`Project Manager.pdf` jobs=0 chunks=7; `Fahed Mrad_CV_Sep_2024.pdf` jobs=0 chunks=15).
   The job table is not a reliable record of what was ingested — which matters directly to Phase
   235, whose SC#1 is a run history.
4. **`SEED-252` — metadata-driven filing.** Many rules contributing instead of first-match-wins
   (`documents.py:2390`'s `break`, D-118-3), and actually moving the file instead of suggesting it
   (D-118-2). Both are deliberate reversals of recorded decisions, not omissions.

⭐ **Findings 2 and 3 are Phase 235's subject already** — SC#2's *"one control that fixes it"* and
SC#1's run history. They arrive there with lived evidence instead of a hypothesis.

---

## ⛔ Still owed, and NOT closed by this document

- **Phase 233's five G-4 rows.** Row 2 first: open a preview, close **without** confirming, then
  verify `documents` / `document_chunks` / `folders` / `ingestion_jobs` are unchanged. It is the one
  criterion whose failure is invisible from the screen.
- **`OD-232-01`** — no live Google Drive **shared drive** has been browsed. ⚠ Ordinary My-Drive
  folder reading is now proven end-to-end by this session; the `/drives` shared-drive claim is not.
- **SC#2, SC#3 and H-5 above are unexercised**, not failed. One green unit suite is not a drive.

---

## The lesson this phase earned

**A capability that ships behind a flag defaulting to off has not shipped — it has been written.**
Phase 234 passed every gate it had, on five waves and 38 backend tests, while being incapable of
running in the operator's process. The gap between *"the code is correct"* and *"the product does
this"* was one boolean, and **nothing in the phase's own verification could see it**, because every
check ran below the level the flag gates.

⭐ The rule: **a phase that adds a process-level enable flag must state, in its verification, which
value the operator's environment actually holds** — measured, not assumed from the default.
