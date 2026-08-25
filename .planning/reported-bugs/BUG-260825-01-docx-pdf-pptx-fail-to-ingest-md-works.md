---
id: BUG-260825-01
title: "DOCX / PDF / PPTX fail to ingest with an error while MD ingests — observed on cloud, cause NOT yet localized"
reported: 2026-08-25
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/ingestion, documents/upload, cloud-parity]
folded_into: null
verified_closed_by: "260825 triage — fixed in 97881102, driven end to end against the local endpoint"
related_seeds: []
re_open_trigger: "the SAME file still fails to ingest on the deployed cloud build after 97881102 ships — the operator's original error text was never captured, so the cloud instance is EXPLAINED, not OBSERVED"
reproduces_on:
  branch: production (cloud)
  commit: unknown — reported from the deployed cloud build, not from a local commit
  date: 2026-08-25
---

# BUG-260825-01: DOCX / PDF / PPTX fail to ingest while MD succeeds

## What we observed

**Operator report (cloud build, 2026-08-25):** uploading `.docx`, `.pdf` and (assumed) `.pptx`
produces an error and the document does not ingest. `.md` files ingest correctly. Email ingestion —
fixed earlier in v3.7 — is working.

⚠ **The error text was not captured.** That is the single most valuable missing piece of evidence
and it is what the first triage step should collect (see *What we still need* below).

## What was measured locally, 2026-08-25 (this investigation)

Every extraction path was driven directly against real, freshly-generated files through the shipped
code — `app.services.extraction_service.get_extractor()` for PDF/DOCX and
`app.api.documents.extract_text()` for the rest:

| File | Allowed at upload | Extracted | Result |
|---|---|---|---|
| `sample.pdf` | ✅ | 38 chars | **OK** — `"Quarterly Note\nRevenue rose 12% in Q3."` |
| `sample.docx` | ✅ | 39 chars | **OK** |
| `sample.pptx` | ✅ | 43 chars | **OK** — `"## Slide 1\nRoadmap\n…"` |
| `sample.xlsx` | ✅ | 67 chars | **OK** — sheet + column header preserved |
| `sample.md` | ✅ | 37 chars | OK |
| `sample.txt` | ✅ | 23 chars | OK |
| `sample.csv` | ✅ | 32 chars | OK |
| `sample.html` | ✅ | 47 chars | ⚠ **OK but WRONG — see BUG-260825-02** |

All extraction dependencies resolve in the local backend venv: `docx`, `pptx`, `openpyxl`, `pypdf`,
`pdfplumber`, `ebooklib`, `reportlab`, `fitz`, `extract_msg`, `bs4` — all import cleanly.

**So the extraction LOGIC is not the defect, at least for clean files.** The failure is either
upstream (rejected before extraction), downstream (chunk/embed/persist), or environment-specific
(the deployed image differs from local).

## Candidate causes, ranked, with the evidence for and against each

### 1. A NUL byte reaching Postgres — the `.msg` failure mode, one path over ⭐ most likely
`documents.py`'s ingestion path performs **no `\x00` stripping anywhere** (`grep -n "x00"` over the
file returns nothing), while **three other paths in this codebase strip it explicitly**:
`agent_loop.py:547-549` (*"Recursively strip PostgreSQL-illegal null bytes"*),
`tool_dispatcher.py:1456` and `:1464`.

This is exactly how the `.msg` bug behaved: a NUL in the subject → `22P05` → ingestion dies, while
files without a NUL sail through. **PDF and DOCX text extraction can readily yield NULs**; Markdown
essentially never does — which would explain the observed split precisely.

⚠ **Against:** the local drive above did not produce a NUL, because the generated fixtures are clean.
**A repro needs a file that actually contains one.**

### 2. A missing extraction dependency in the DEPLOYED image
All ten extraction libraries import locally. If the cloud image was built without `pdfplumber` /
`python-docx` / `python-pptx`, every one of those types fails while `.md` (pure stdlib) succeeds —
also matching the observed split exactly.
**Cheap to check and worth checking first**, because it is an env fix rather than a code fix.

### 3. MIME rejection at the door — possible but does not fit cleanly
`upload_document` normalises a misreported MIME by extension, but `_EXT_MIME_OVERRIDES` covers only
`.md .csv .pptx .xlsx .epub .eml .msg` — **`.docx` and `.pdf` are absent.** So a browser reporting
either as `application/octet-stream` gets a 422 *"Unsupported file type"*.
⚠ **Against:** `.pptx` IS in the override list and is reported as failing too, so this cannot be the
whole story. **It is still a real robustness gap and should be closed regardless** — adding `.docx`
and `.pdf` costs two lines.

## Why it matters

Document ingestion is the product's front door. Three of the most common business formats failing —
while the format almost nobody uploads succeeds — makes the knowledge base unusable for its actual
purpose. It also has a cloud-parity smell, which historically is this project's most expensive class
of bug.

## What we still need (first triage step, in order)

1. **The exact error text and HTTP status** from the cloud upload. A 422 points at cause 3; a 500
   with `22P05` confirms cause 1; a 500 with `ModuleNotFoundError` confirms cause 2.
2. `documents.error_message` and `documents.ingestion_step` for one failed row in the cloud DB —
   the pipeline records both.
3. Whether the SAME file fails locally. If it succeeds locally and fails in cloud, causes 2 wins.

## Proposed fix direction (not yet scoped)

- Strip `\x00` on the documents ingestion path, the way three other paths already do — **and do it
  once, centrally**, rather than adding a fourth private copy.
- Add `.docx` and `.pdf` to `_EXT_MIME_OVERRIDES`.
- Add a **per-format ingestion test that drives a real file of every allowed MIME type end to end**,
  including one deliberately carrying a NUL. The current suite did not catch this.

---

## RESOLUTION — 2026-08-25. Diagnosed by driving the REAL endpoint, then fixed.

Commit `97881102`. Every claim below was measured by POSTing real generated files through
`POST /documents/upload` against the running local stack and reading `documents.status`,
`documents.ingestion_step` and `documents.error_message` back out of Postgres — never by
calling an extractor directly, which the report already proved says nothing about this bug.

### The ranking in this report was WRONG, and the reason is instructive

Cause 3 ("MIME rejection at the door") was ranked LAST and half-dismissed, on the grounds
that *"`.pptx` IS in the override list and is reported as failing too"*. But the report
itself records `.pptx` as **assumed**, not observed — and the confirmed set is `{docx, pdf}`,
which is **exactly** the set missing from `_EXT_MIME_OVERRIDES`. **A dismissal that rests on
an assumption is not a dismissal.**

### ⭐ THE OBSERVED SPLIT, REPRODUCED — the door, not the extractor

Every row measured against the live endpoint, before the fix:

| File | announced Content-Type | before | after |
|---|---|---|---|
| `sample.docx` | `application/vnd…wordprocessingml.document` | ✅ 201 | ✅ |
| `sample.docx` | `application/octet-stream` | ⛔ **422** | ✅ |
| `sample.docx` | `application/zip` | ⛔ **422** | ✅ |
| `sample.docx` | `application/msword` | ⛔ **422** | ✅ |
| `sample.docx` | *(none sent)* | ⛔ **422** | ✅ |
| `sample.pdf` | `application/pdf` | ✅ 201 | ✅ |
| `sample.pdf` | `application/octet-stream` | ⛔ **422** | ✅ |
| `sample.pdf` | *(none sent)* | ⛔ **422** | ✅ |
| `sample.pptx` / `sample.xlsx` / `sample.md` | `application/octet-stream`, `application/zip` | ✅ 201 | ✅ |

⚠ **`.md` PASSES under `application/octet-stream` and `.docx`/`.pdf` DO NOT.** A client that
reports `octet-stream` for binaries therefore fails exactly docx + pdf and succeeds on md —
the operator's report character for character. The 422 body even reads *"Unsupported file
type: application/octet-stream. Allowed: PDF, DOCX, Markdown, plain text"*, which is what a
person sees after uploading a PDF.

**Fixed:** `.docx` and `.pdf` added to `_EXT_MIME_OVERRIDES`; the "the client did not really
know" trigger list is now the named `_UNRELIABLE_MIME_TYPES`, extended with
`application/msword` and the empty string **on measurement, not on principle**. Correction
stays keyed on the EXTENSION, so a genuine legacy `.doc` is still refused rather than
mislabelled — asserted by a test.

### Cause 1 (NUL) — CONFIRMED as a real, independent defect, but NOT the observed split

Two rows failed in the pipeline rather than at the door:

```
nul.txt  201 → status=failed  ingestion_step=embedding
         22P05  \u0000 cannot be converted to text
nul.csv  201 → status=failed  ingestion_step=embedding   (same)
```

That is the Phase 203 `.msg` failure exactly, one path over. It is real and now fixed —
`scrub_text` moved to the single home `app/services/text_sanitize.py` (body unchanged,
re-exported from `email_extraction_service` so the Phase 203 import path stays live), and
`ingest_document` scrubs at **the single funnel every ingest route passes through**. Siting
it in `extract_text` instead would have missed the PDF/DOCX composer branch, which never
calls it. Verified after the fix: both files reach `status=completed`, chunk written, no NUL.

⚠ **But it does not explain the operator's split**, because a NUL is content-dependent, not
format-dependent — a markdown file carrying one fails identically.

### ❌ REFUTED — "PDF and DOCX text extraction can readily yield NULs"

**A DOCX cannot carry a NUL into extracted text.** XML forbids NUL, so `python-docx`/lxml
refuses the file at parse time with `Char 0x0 out of allowed range` — a *different* error,
raised *before* any text exists, and one no amount of scrubbing can rescue. Measured by
injecting a NUL into `word/document.xml` of a real `.docx`. Pinned by
`test_a_docx_carrying_a_nul_fails_in_the_parser_not_in_the_database`. **PDF remains
untested** — reportlab will not emit one — so that half of the claim is unproven, not refuted.

### ⚠ WEAKENED — cause 2, "a missing extraction dependency in the DEPLOYED image"

`pypdf`, `python-docx`, `pdfplumber`, `pymupdf`, `python-pptx`, `openpyxl`, `ebooklib` and
`extract-msg` are **all declared in `backend/requirements.txt`**, and `backend/Dockerfile`
installs the file wholesale (filtering only `sentence-transformers`). So the deployed image
has them unless the build itself failed. Not disproven — nobody has run `pip list` in the
running container — but no longer the leading candidate.

⚠ **One genuinely missing dependency WAS found, and it belongs to BUG-260825-02:**
`beautifulsoup4` is installed in the local venv but is **NOT** in `requirements.txt`. Fixing
the HTML bug with bs4, as that report proposed, would have shipped a cloud-only `ImportError`.

### The test that was missing

`backend/tests/unit/test_per_format_ingestion.py` — 37 cases. It builds a **real** file of
every allowed MIME type with the same libraries the extractors read with (nothing checked in
to rot), drives each through the shipped routing decision, and includes a totality assertion
that fails when a MIME type is added to `ALLOWED_MIME_TYPES` with no real file behind it.
NUL and misreported-Content-Type cases included.

### What is still owed

The operator's cloud instance is **explained, not observed** — the original error text and
status code were never captured. If the same file still fails on the deployed build after
this ships, re-open: at that point cause 2 is back on the table and the first step is
`pip list` inside the running container.
