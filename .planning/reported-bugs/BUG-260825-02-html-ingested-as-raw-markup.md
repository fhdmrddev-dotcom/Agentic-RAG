---
id: BUG-260825-02
title: "text/html is ingested as RAW MARKUP — tags land in the chunk text and therefore in the embeddings"
reported: 2026-08-25
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [backend/ingestion, RAG/retrieval-quality]
folded_into: null
verified_closed_by: "260825 triage — fixed in 63735613, verified end to end through the real upload endpoint"
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 97af4ed1
  date: 2026-08-25
---

# BUG-260825-02: HTML is ingested as raw markup

## What we observed

⚠ **Found by measurement while investigating BUG-260825-01 — not reported by the operator.** It was
sitting in the same table of results and would have gone unnoticed, because the format "works": it
ingests, it produces text, nothing errors.

Driving `extract_text(raw, "text/html")` through the shipped path with a real file:

```
input :  <h1>Quarterly Note</h1><p>Revenue rose 12%.</p>
output:  '<h1>Quarterly Note</h1><p>Revenue rose 12%.</p>'   ← 47 chars, IDENTICAL
```

The markup is not stripped. `text/html` is in `ALLOWED_MIME_TYPES`, so this ingests happily and the
tags flow into chunking, into the embeddings, and into whatever the agent later cites.

## Why it matters

This is a **silent quality defect, not an error** — which is why nothing has caught it. The document
appears in the library, the chunk count looks sane, retrieval returns hits. But every chunk's
embedding is computed over `<h1>` and `<p>` noise, and any quoted passage the agent shows a person
carries raw tags.

`beautifulsoup4` is already installed in the backend venv (verified this session), and the email
extractor already uses HTML-to-text conversion — so the capability exists in the codebase and simply
is not applied on this path.

## Scope note

Low severity because HTML is an uncommon upload format for this product. Recorded rather than fixed
because it is **not** what the operator reported, and folding an unrequested fix into a bug they are
waiting on is how a triage round turns into a phase.

## Proposed fix direction

Route `text/html` through the same HTML-to-text conversion `email_extraction_service.py` already
uses, rather than adding a second one. Cover it in the per-format ingestion test proposed in
BUG-260825-01 — a test that asserts *"extraction returned text"* would pass against this defect, so
the assertion has to be that **no markup survives**.

---

## RESOLUTION — 2026-08-25

Commit `63735613`. `text/html` is routed through the email parser's existing
`html_to_plain_text`, so there is still exactly one HTML-to-text converter in the codebase.

Verified end to end through the real `POST /documents/upload`, reading the chunk back out of
`document_chunks`:

```
in    <html><head><style>p{color:red}</style></head><body><h1>Quarterly Note …</h1>
      <p>Revenue rose 12&nbsp;percent &amp; margin held.</p>
      <script>var leak='do not embed me';</script></body></html>
chunk 'Quarterly Note 1787666896\nRevenue rose 12\xa0percent & margin held.'
```

No tags, entities unescaped, and the `<script>` and `<style>` bodies are gone rather than
merely un-tagged — they were reaching the embeddings as content.

### ❌ REFUTED — the proposed route would have broken the cloud

This report says *"`beautifulsoup4` is already installed in the backend venv (verified this
session)"*, and that is true. **It is NOT declared in `backend/requirements.txt`**, and
`backend/Dockerfile` installs from that file, so the deployed image does not have it.
Reaching for bs4 here would have shipped an `ImportError` that reproduces only in cloud —
this project's most expensive class of bug. `html_to_plain_text` needs no dependency at all:
it is stdlib `html.parser`.

### The assertion shape this report asked for

`backend/tests/unit/test_html_extraction_no_markup.py` asserts **absence** — no `<h1>`,
`<p>`, `<script`, `<style`, `<html`, `<body`, no script body, no CSS, and `&amp;` unescaped —
plus an explicit *"extraction is not the identity function"* case, which is precisely the
shape a passing `assert text` could not distinguish from the defect.
