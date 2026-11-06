---
id: BUG-261106-04
title: Every email is invisible to date filters (its date carries a time, so date_typed is NULL)
reported: 2026-11-06
surface: Agentic-RAG
severity: high
status: open
affected_areas: [backend/retrieval-scope, database/documents-typed-columns, ingestion/email]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 729733468
  date: 2026-11-06
---

# BUG-261106-04: Every email is invisible to date filters

Found by the tester's chat answer key, HR-22 (2026-11-06, deepseek-v4-flash, thread scoped to
Aldara-FM): "What did HR announce to all staff in December 2025?"

## What we observed

The agent ran one `search_documents` with `{"op":"between","field":"date","value":"2025-12-01","value2":"2025-12-31"}`.
The tool answered `no_documents_matched` and reported 4 undated documents. The answer said no
document is dated December 2025. `2025-12-15 Updated Leave Policy from 1 January 2026.eml` is in
the folder and was cited in HR-02, HR-03 and HR-16 the same day.

## Cause (verified in production data and code)

| File | `metadata->>'date'` | `date_typed` |
|---|---|---|
| 2025-12-15 Updated Leave Policy ... .eml | `2025-12-15T09:12:00+04:00` | NULL |
| 2026-11-04 Onboarding prep ... .eml | `2026-11-04T10:41:00+04:00` | NULL |
| HR-POL-003 Leave Policy v3.0.pdf | `2026-01-01` | 2026-01-01 |

`documents.date_typed` is `GENERATED ALWAYS AS (public.view_iso_to_date(metadata->>'date')) STORED`
(`supabase/migrations/074_view_typed_columns.sql:97`). `view_iso_to_date` returns NULL unless the
value is exactly `^\d{4}-\d{2}-\d{2}$` (line 84). The email extractor stores the full RFC 3339
timestamp, so every email (uploaded `.eml` and connected mailboxes) counts as undated for the
date filter, the Library date views and the D-06 "undated" count.

## Fix direction (not done)

- Accept a leading `YYYY-MM-DD` followed by a time (take the date as written, before the offset),
  in a new migration; a generated column only recomputes on write, so existing rows need a
  rewrite (for example `UPDATE documents SET metadata = metadata WHERE metadata->>'date' ~ 'T'`).
  Production DB change: needs operator approval.
- Or store a date-only value at email ingest and keep the timestamp under another key.
- Secondary (model behaviour): after a zero-match date filter that reports undated documents,
  the agent should retry without the filter. It did not.

## Surface classification

Agentic-RAG: the app's own ingestion and retrieval.
