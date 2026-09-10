# Phase 233 — what the first real UAT found

**Date:** 2026-09-05 · **Method:** the operator imported a real Google Drive folder and reported
five observations. Investigating them surfaced **six defects**, four of them fixed here.

⭐ **THE HEADLINE: 5,600 automated tests found none of these, and one folder import found all of
them.** The reason is structural rather than careless — **the connector import door was not the
door `/upload` uses**, and every difference between the two was invisible on screen. That is the
argument for lived-experience UAT (G-4) in one paragraph, and it is why 233's verification recorded
the owed rows rather than closing without them.

---

## What the operator said, and what was actually wrong

| # | Reported | Verdict |
|---|---|---|
| 1 | connected sources buried under a huge dropzone | ✅ true — **deferred, needs a sketch (G-2)** |
| 2 | sub-folders not read | ✅ true — the adapter **ignored its own `recursive` flag**; **FIXED**, see BUG-07 |
| 3 | confirm ingests with no signal | ✅ true, and **caused by (4)** — no job row meant nothing to show |
| 4 | "why does everything queue now?" | ⚠ **not a regression** — Phase 230's design, `INGEST_MAX_CONCURRENT_JOBS = 3`. **But the connector path was not queuing at all**, which is the real defect |
| 5 | files failing, even PDFs and DOCX | ✅ true — **three separate causes**, none of them "PDFs are broken" |
| — | *(not reported — found while investigating)* | ⛔ **provenance destroyed on every successful ingest** |

---

## BUG-260905-03 — provenance destroyed on success ⛔ the worst of them

`documents.py` writes `"metadata": metadata_dict` **wholesale** at completion. `metadata_dict` is
built from the *extracted* metadata and has never heard of the mint-time `source` key, so tier-1
identity was deleted the moment a document completed.

**Measured on real rows, which is how it was found at all:**

```
13:35:42  completed  src=None                    O6 OPERATIONALIZATION COMPLETE...
13:33:19  failed     src={google, 1GofDH...}     FMrad_AI_writing_report.pdf
13:31:50  completed  src=None                    Fahed Mrad - CV.pdf
```

⭐ **Only the FAILED rows kept their identity** — because only they never reached the completion
write. **The "Already here" bucket, the one thing Phase 233 exists to make honest, would have
matched nothing, forever.**

⚠ **My unit tests mocked the splice, so they never saw the clobber.** That is a real gap in how the
phase was verified, not a typo — a preview test that stops at the wire boundary cannot see a key
being deleted three functions later.

**Fix:** carry `_PROVENANCE_KEYS` forward at the **same site** as the existing `_source` user-edit
guard, off the **same** `prior_meta` read. That site is the single metadata-write all three
re-extract entry points funnel through (`/upload`, `/reingest`, `/reextract`) — Pitfall 1, one key
over. `setdefault`, not assignment, so a fresher identity still wins.

---

## BUG-260905-04 — the durable queue was bypassed

`import_single_file` called `background_tasks.add_task(splice_document)` instead of enqueuing.
**Measured: 93 completed documents against 6 job rows**, with every connector import missing.

Four consequences, none visible on screen:

1. **No retries, no lease recovery** — Phase 230 built exactly that and this path opted out.
2. **Unbounded parallelism** — one task per file, so ten 10 MB PDFs ran at once.
3. ⚠ **Enriched metadata silently degraded on every connector import.** `ingest_document` calls
   `asyncio.run(extract_metadata_enriched(...))` at `documents.py:2021`. Inside a `BackgroundTask`
   the loop is already running:
   ```
   RuntimeError: asyncio.run() cannot be called from a running event loop
   WARNING enriched metadata extraction failed; degrading to None
   ```
   The queue worker runs the same function from a threadpool, where it is fine. **The same file
   ingested through two doors got two different metadata results, and only the log said so.**
4. **The Ingestion tab could not account for the work** — which is the whole of finding (3).

⚠ **The non-obvious part of the fix:** the worker calls `splice_document` with no `raw` and
**downloads from `file_path`**. The legacy path never uploaded either — `splice_document` did, from
bytes it was handed. So enqueuing alone would have given the worker `b""` and failed the document
with a message blaming the *file*. **The upload now precedes the enqueue, and a failed upload
refuses to enqueue** and falls back to the direct splice, which still holds the bytes.

---

## BUG-260905-05 — one engine's bug condemned readable documents

Reproduced exactly, from inside pypdf:

```
pypdf/_cmap.py:427  in build_font_width_map
  second = w[1].get_object()
IndexError: list index out of range
```

A malformed `/W` font-width array in the file — not our call. But `extract_composable` let it
escape and failed the whole document. **The same bytes, through the other registered engine:**

```
FMrad_Similarity_report.pdf     legacy=FAIL(IndexError) | pymupdf=OK(50775 chars)
FMrad_AI_writing_report.pdf     legacy=FAIL(IndexError) | pymupdf=OK(49128 chars)
Paperpal Plagiarism Check.pdf   legacy=FAIL(IndexError) | pymupdf=OK(48308 chars)
```

**The documents were never unreadable. They were readable by the engine we did not try.**

**Fix:** ordered fallback — the configured engine **always first** (an operator's engine choice is a
setting with quality consequences, not a hint), then any other. If **every** engine fails it still
raises, exactly as D-069-04 requires, but the message now names each attempt. ⭐ `extractor_name`
reports the engine that **actually** read the bytes, so a fallback is visible in the lineage column;
one nobody can see is one nobody can audit.

---

## BUG-260905-06 — storage keys refused, and the refusal was swallowed

```
StorageApiError {'statusCode': 400, 'error': 'InvalidKey',
  'message': 'Invalid key: <user>/<doc>/Cambridge IELTS 14 with Answers GT [www.luckyielts.com].pdf'}
```

Square brackets. ⚠ **The failure was invisible because both upload sites swallow storage errors by
design** (a `log.warning` and a `log.debug`, so a storage hiccup does not lose an ingest). The
document sailed on to extraction with **no bytes ever stored** and failed with an **empty
`error_message`** — which is what two of the six failures were. **The blank message was the tell:**
every honest failure path in this pipeline names a cause.

**Fix:** `_storage_safe()` at the single minting site, so `file_path` is written sanitised **once**
and every later reader derives the same key from the column. ⛔ `documents.filename` is untouched —
a sanitiser that renamed the document would fix the 400 by lying about the file. ⚠ `/` is
deliberately **not** in the unsafe set; it is the key's own separator.

---

## Verification

- `test_260905_ingest_fixes.py` — **30 cases**, one class per defect.
- Backend `pytest tests/unit`: **72 failed before, 72 failed after** — no regression, and **no
  improvement either.**

  ⚠ **CORRECTION, recorded rather than quietly fixed.** This line first read *"72 → 71 failed …
  BUG-05 fixed one of the inherited failures"*, and the commit message `81bba8764` says the same.
  **That was one reading, and it was an outlier.** Re-measured three times consecutively after the
  recursion work: `72 / 72 / 72`, with the per-file failure distribution **identical to the
  pre-fix baseline** (`diff` over `pytest -q | grep ^FAILED | uniq -c` returns empty). Driving it
  directly settles it: `test_extraction_service.py` fails the same **two** cases with the fallback
  stashed and with it applied, so **BUG-05 fixed neither.**

  **The tree is therefore still ONE over the `CLAUDE.md` ceiling of 71, and was before this phase
  started.** The correct claim is *"this work adds no failure"*, which the identical distribution
  proves; the stronger claim was mine and it was wrong. ⭐ **The lesson is the one this repo keeps
  re-learning: a single green-ward reading is not a measurement.** The `+40` passed cases between
  the two runs are this work's own tests.
- Frontend `count gate OK — 224/224, 0 failing, total 7498`.
- Live: the previously-failing PDF now extracts **50,775 chars** with lineage
  `composable[pymupdf/camelot/pymupdf_full/none]`.

---

## BUG-260905-07 — a flag that had never done anything

`SourceAdapter.list_files` has taken `recursive: bool = False` since Phase 232 and
**neither shipped adapter ever read it** — `grep -rn recursive` returned **three declarations and
zero uses**. So the preview looked one level deep while its own signature advertised otherwise, and
a person who pointed at a nested folder was shown less than they had selected **with nothing on
screen saying so**. That last clause is what makes it a Phase 233 defect rather than a missing
feature: the phase's whole claim is that the preview is honest about what it knows.

### Where the walk lives, and why not in the adapter

`walk_source_files()` sits in `preview_service`, on top of `browse()` + `list_files()`. That is the
Phase 232 design claim honoured rather than quietly dropped — *adding a source family is data and
registration, never an ingest path*. **Microsoft Graph (238) and MCP (239) inherit recursion by
existing**, and there is exactly one budget to reason about instead of one per family. The adapter
is still asked for **one level at a time**, and a test asserts that.

### ⛔ The budget is a refusal to guess, not a performance tweak

Someone will point this at *My Drive*. An unbounded walk is a request that never returns and a Drive
quota that does — so it stops at `MAX_DEPTH 5 · MAX_FOLDERS 200 · MAX_FILES 2000 ·
MAX_PAGES_PER_FOLDER 20`, and **`stopped_by` names which budget stopped it.** The screen prints that
reason, because *"some files"* is the sentence that lets a person assume the rest were fine. This is
the same fence `SRC-06` puts on the watch loop one phase later, and the reason Onyx once removed 976
documents it believed were deleted at the source.

### Two bugs the tests found before the operator could

⭐ **A cycle re-listed the start folder.** `seen` was seeded from *children only*, so a sub-folder
linking back to its parent re-read the parent and double-counted its files. `seen` is now seeded
with the start folder — which is what makes it a *visited* set rather than a *queued* set.

⭐ **A Drive file can have MORE THAN ONE PARENT**, so two folders legitimately return the same file
in one walk. Unfixed, the preview counts it twice and the confirm then disagrees with it — **SC#4
broken by arithmetic rather than by logic**, which is the hardest kind to notice. Files are now
deduped by id during the walk.

### What the screen now says

`scannedLine()` distinguishes three different facts that the first version could state none of:
*"This folder only — sub-folders were not read"* · *"This folder — it has no sub-folders"* ·
*"This folder and 3 sub-folders."* ⚠ The middle one and the first one are **not** the same claim,
and a test asserts they never render identically.

**11 backend cases + 5 frontend cases**, including a positive control per budget.

---
## D-233-07 REVERTED — the Library is full-width

The width decision was **wrong and is reverted the same day**, on the operator's *"why is it not
full-width like other pages"*. The reasoning is kept rather than deleted, because the error is
instructive: **it derived "one measure for the whole app" from two pages and never checked the
rest.** Re-measured across every page:

| Page | Width | Shape |
|---|---|---|
| Settings · Connections | `max-w-6xl` (1152) | **forms** |
| Workflows | `max-w-[1200px]` | cards |
| Skills · Chat | **none — full width** | **data** |
| Library | **none — full width** | **data** |

⭐ **The convention is not one number. It is: form-shaped pages are constrained, data-dense pages
are full width.** The Library is a folder rail beside a seven-column table whose columns 3-5
already shed by `nth-child` under pressure — narrowing it spends the width that table needs.

---

## Still open

| # | Item | Why not now |
|---|---|---|
| 1 | the dropzone / connected-source split | **live UI whose value is how it reads — G-2 says sketch it first** |
| 7 | **the advertised format list is stale** | the dropzone prints 8 formats; the server accepts **17**. HTML, `.eml`, `.msg`, `.xls` and DXF all have working parsers and no door. The frontend list is deliberately a SUBSET — widening it is a product decision, not a constant edit |
| 8 | **images (jpg/png) and OCR** | ✅ **SHIPPED 2026-09-05** (`b4595f201`, SEED-226 L1+L2). The answer to *"which OCR engine"* was **none** — `vision_text.py` uses the vision LLM that already shipped, with a TRANSCRIPTION prompt instead of a caption one. Six image mimes now pass the upload gate; a scanned PDF is rendered and transcribed; a vector drawing is transcribed whole-page. ⚠ The `needs OCR` sentence is gone and fenced. ⛔ Still open: L2.5 vector-geometry takeoff, DWG conversion, and the rate-line ambiguity escalation — see SEED-226 |
