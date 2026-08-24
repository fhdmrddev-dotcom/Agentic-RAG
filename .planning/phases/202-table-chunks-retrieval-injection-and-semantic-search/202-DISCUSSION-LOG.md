# Phase 202: Table Chunks Retrieval Injection & Semantic Search - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-24
**Phase:** 202-table-chunks-retrieval-injection-and-semantic-search
**Areas discussed:** Table Representation in Vector Chunks, Table Partitioning, Chunk Metadata, Ingestion & Backfill

---

## Table Representation in Vector Chunks

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid Schema Header + Markdown Table | [Table 1 \| Page 2 \| Columns: A, B]\n\| A \| B \|\n\|---\|---\|\n\| 1 \| 2 \| | ✓ |
| Row-by-Row Key-Value Anchors | Row 1: A=1, B=2\nRow 2: A=3, B=4 | |
| Dense Markdown Only | Standard markdown table format without custom header brackets | |

**User's choice:** Hybrid Schema Header + Standard Markdown Table
**Notes:** Chosen for clear semantic boundaries, searchability across schema and row details, and clean markdown for LLM synthesis.

---

## Table Partitioning & Large Tables

| Option | Description | Selected |
|--------|-------------|----------|
| Row-batched with Header Propagation | Max 25-30 rows per chunk, repeating markdown column headers on every chunk split | ✓ |
| Dynamic Token Fitting | Fill up to chunk_size ~1000 chars, prepending table headers to each fragment | |
| One Chunk per Page / Table | Split strictly by page or sheet, truncating if oversized | |

**User's choice:** Row-batched with Header Propagation (Max 25-30 rows per chunk)
**Notes:** Ensures every split chunk contains the full column headers so vector embeddings and downstream LLMs never encounter orphan cells without schema.

---

## Chunk Metadata & Search Attribution

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated Table Chunks with Metadata Tags | Store with is_table: true, page, 	able_index, and column lists in chunk metadata | ✓ |
| Standard Text Chunks | Insert formatted markdown into the standard chunk flow without special metadata keys | |
| Separate Table-Only Vector Namespace | Store in a dedicated table chunk store | |

**User's choice:** Dedicated Table Chunks with Metadata Tags
**Notes:** Enables frontend citation viewers and retriever post-processors to identify table chunks easily.

---

## Ingestion Lifecycle & Backfill

| Option | Description | Selected |
|--------|-------------|----------|
| Ingestion + Reingest + Background Backfill Helper | New/reingested docs process automatically; provide a backfill function to index existing tables | ✓ |
| Only On-Demand | Only apply when documents are uploaded or user clicks Reingest in UI | |
| Automatic Server Startup Migration | Run on app start to backfill all historical tables | |

**User's choice:** Ingestion & Reingest + Background Backfill Helper
**Notes:** Balances clean runtime lifecycle with the ability to index existing documents in document_tables.

---

## Claude's Discretion

- Markdown sanitization (handling newlines/pipes inside cell content).
- Token-safety threshold tuning for very wide tables (>20 columns).

## Deferred Ideas

None.
