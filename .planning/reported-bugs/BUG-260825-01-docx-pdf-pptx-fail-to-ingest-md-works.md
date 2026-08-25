---
id: BUG-260825-01
title: "DOCX / PDF / PPTX fail to ingest with an error while MD ingests — observed on cloud, cause NOT yet localized"
reported: 2026-08-25
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/ingestion, documents/upload, cloud-parity]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
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
