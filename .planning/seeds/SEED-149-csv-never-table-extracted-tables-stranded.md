---
id: SEED-149
title: A CSV is never table-extracted, so query_table is dead on the one format that IS a table — and separately, extracted tables are stored but largely never reach the chunks retrieval searches
status: open
planted: 2026-08-10
planted_by: Operator, reviewing the app after the v3.6 deploy (2026-08-10) — "Query Table tool always resulting in Error >>> No tables found for document 'rag_corpus_documents.csv' <<<", plus "we are not sure if it is injected back in the chunks table or how the mechanism would be"
surface: Agentic-RAG
severity: warning
category: ingestion + retrieval quality — structured data
priority: high
scope: Two distinct defects in one seed because they share a diagnosis. Split at planning time.
affected_areas: [ingestion-pipeline, multimodal-service, document-tables, document-chunks, retrieval, query-table-tool]
related_seeds: [SEED-060, SEED-087, SEED-006]
re_open_trigger: >
  Re-open when ANY of these is true: (1) an ingestion/retrieval milestone opens — both halves belong
  there; (2) any user uploads a spreadsheet or CSV and asks a question about its rows; (3) any phase
  touches `_fetch_document_tables`, the chunker, or `query_table`; (4) SEED-087's table-searchability
  work is picked up — these are the same subject and should merge.
---

# SEED-149 — structured data is extracted, then stranded

Two defects, measured on local dev 2026-08-10. They are filed together because both are the same
underlying story — **the table pipeline ends before the table is reachable** — but they are separate
fixes and should be split into separate work items at planning time.

## Defect A — a CSV is never table-extracted

**Reported symptom:** `query_table` always errors with
`No tables found for document 'rag_corpus_documents.csv'`.

**Measured:** the document is real and healthy — `status: completed`, `mime_type: text/csv`,
**220 chunks**. And `document_tables` for it holds **0 rows**.

So the tool is answering *correctly*. The error is honest; the pipeline is what is wrong. Table
extraction populates `document_tables` from `.docx` and PDF, and a CSV is ingested as plain text and
chunked. Measured distribution across the corpus:

| Document | `document_tables` rows |
|---|---|
| `FMrad_FT_Approved_06062026.docx` | 39 |
| `Defence_Guide_Presentation.docx` | 39 |
| two scanned PDFs | 2 each |
| `risk-register.docx`, `Project-Meridian-Risk-Workshop-Notes.docx` | 1 each |
| **`rag_corpus_documents.csv`** | **0** |

**The irony is the point:** a CSV is nothing *but* a table. The one file type where "query the table"
is the only sensible question is the one type that has no table to query. Any user who uploads a
spreadsheet to ask about its rows hits a dead tool with a message that reads like their file is
broken.

## Defect B — extracted tables largely never reach retrieval

**The operator's question:** *"we are not sure if it is injected back in the chunks table or how the
mechanism would be — also same for tables."*

**Measured, and the answer is mostly no:**

- `document_tables` holds **84 rows** across the corpus.
- `document_chunks` holds **922 rows**, of which only **3** look like a markdown table
  (`content` containing both `|` and `---`).
- 57 chunks reference a table/image marker of some kind.

So tables are extracted and stored in their own table, and then **the text a semantic search actually
searches does not contain them**. A question whose answer lives in a table row is answerable only if
the agent thinks to call `query_table` by name — which requires it to already know a table exists.
Vector search will not lead it there.

⚠ **This is a measurement of the local corpus, not a reading of the chunker.** It is strong evidence
of the outcome, not proof of the mechanism. Before designing a fix, read the ingestion path and
establish *whether* injection was ever intended and where it drops — do not infer the code from these
counts.

## One thing the operator reported that did NOT reproduce

> "in the image table the description column is null"

**Measured: false on local.** `document_images` has 25 rows and **0** have a NULL `description`.
Either this is cloud-only, or specific to one document, or it was a transient state during ingest.
Recorded here so nobody builds a fix for a defect that may not exist — **re-measure before acting**,
and if it reproduces on cloud, that is its own report.

## Why this outranks its "info" appearance

The product's entire premise is a knowledge base you can ask questions of. Tabular data is where the
answerable facts usually live — risk registers, compliance matrices, budgets, corpora. Both defects
mean the app confidently ingests a file, reports success, and then cannot answer the most obvious
question about it. This is the same shape as BUG-260809-02 and D-190-DEF-09: **the surface says it
worked, and the capability is unreachable.**

## Suggested routing

An ingestion/retrieval milestone, merged with **SEED-087** (table searchability) and **SEED-060**
(structure-aware chunking / tabular ingestion) — these three are one subject and should not be
planned separately. Defect A is likely small and independent; consider carving it out early since a
CSV→`document_tables` path is self-contained and unblocks the tool immediately.
