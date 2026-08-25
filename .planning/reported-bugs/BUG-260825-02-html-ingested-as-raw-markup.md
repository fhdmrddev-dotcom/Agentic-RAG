---
id: BUG-260825-02
title: "text/html is ingested as RAW MARKUP — tags land in the chunk text and therefore in the embeddings"
reported: 2026-08-25
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [backend/ingestion, RAG/retrieval-quality]
folded_into: null
verified_closed_by: null
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
