---
id: BUG-260516-04
title: POST /documents/{id}/reingest does not delete prior document_tables or document_images — accumulates rows on every click
reported: 2026-05-16
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/api/documents, backend/ingestion, data-integrity, RAG/retrieval-quality]
folded_into: 071.4
related_seeds: [SEED-022]
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 2907dbf
  date: 2026-05-16
---

# BUG-260516-04: /reingest does not delete prior tables/images → accumulation

## What we observed

Operator hit "Reingest" on the Library Health dashboard three times in a row
against the same thesis PDF + DOCX after Phase 071.4-01's camelot precision
floor landed. Counts grew **deterministically** by a fixed amount per click:

| Run | DOCX tables | DOCX imgs | PDF tables | PDF imgs | PDF chunks |
|-----|-------------|-----------|------------|----------|------------|
| 1 (Plan 05 UAT era) | 39 | 20 | 214 | 20 | 461 |
| 2 (post-floor reingest)  | 78 (+39) | 40 (+20) | 262 (+48) | 40 (+20) | 441 (stable) |
| 3 (post-restart reingest) | 117 (+39) | 60 (+20) | 310 (+48) | 60 (+20) | 441 (stable) |

Smoking-gun signature:
- DOCX tables grow **+39 per click** (which IS the actual fresh-extract count
  per the operator's ground truth assertion).
- DOCX images grow **+20 per click** (fresh-extract count).
- PDF tables grow **+48 per click** (fresh post-floor extract count).
- PDF images grow **+20 per click**.
- **Chunks stay stable** (461 → 441 → 441) because they ARE deleted in
  `_upload_pipeline` before re-insert.

Each reingest is APPENDING new table/image rows on top of the existing ones
without deleting the prior set.

## Why it matters

**Major severity** — silent data corruption on every click:

1. **Retrieval pollution.** After N reingests, `document_tables` and
   `document_images` contain N times more rows than the document actually has.
   Every retrieval query that hits these tables returns duplicates.
2. **Storage cost** grows linearly with click count.
3. **Confidence + counts are wrong** — every UI surface that shows table /
   image counts (Documents page, Library Health) lies. The user's earlier
   observation that "the count of tables and images does not reflect
   real-time" is partially this — the counts ARE being updated, they're
   just wrong.
4. **Phase 076 prerequisite hidden under noise.** The PDF "214 tables" cited
   in Plan 05 UAT is one extract's output, not the steady-state count;
   subsequent reingests would have inflated it further. We needed SEED-022's
   precision audit to be measured against a clean baseline — the fresh
   post-floor count is actually **48** (PDF) and **39** (DOCX), excellent
   precision. The accumulation masked this win.
5. **Risk of cascading bad assumptions.** Every analysis built on the wrong
   counts compounds. Phase 076 chunk-distribution recalibration would have
   learned the wrong distribution.

## Hypothesized cause

Direct code inspection — not a hypothesis:

`backend/app/api/documents.py::reingest_document` at lines 643-717 has NO
delete calls for `document_tables` or `document_images`. The matching
`reextract_document` at lines 720-825 explicitly deletes all three at
lines 803-811:

```python
await run_in_threadpool(
    lambda: supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
)
await run_in_threadpool(
    lambda: supabase.table("document_tables").delete().eq("document_id", document_id).execute()
)
await run_in_threadpool(
    lambda: supabase.table("document_images").delete().eq("document_id", document_id).execute()
)
```

The 4-line fix is to add the same two delete-table calls (tables + images)
to `/reingest` between its storage download (line 686) and its status reset
(line 691). Chunks already get cleaned in `_upload_pipeline` so chunks are
fine.

Likely root cause of the original omission: Phase 071.2 D-071.2-06 refactor
ported `/reextract`'s threadpool sweep into `/reingest` but cargo-culted
only the threadpool wrappers, missing that `/reingest` should ALSO mirror
the delete cascade. Easy mistake — the threadpool sweep is what's
documented in the decision; the delete cascade is implicit.

## Surface classification

`Agentic-RAG` — backend bug. Routes per CLAUDE.md cross-check.

## Suggested routing

- **Fold into Phase 071.4 as Plan 04** (operator decision 2026-05-16). Plan
  is small (~4 LOC fix + 1 regression test + SQL cleanup + verification
  reingest). ~30-45 min total work.

## Workarounds (pre-fix)

- **Use `/reextract` instead** via `http://localhost:8000/docs` → `POST
  /documents/{id}/reextract` → `Try it out` → `{}` body. `/reextract` has
  the correct delete cascade.
- **Avoid clicking Reingest more than once per document** until fixed.
- **For already-polluted documents**, manual SQL cleanup before next
  reingest:
  ```sql
  DELETE FROM document_tables WHERE document_id = '<id>';
  DELETE FROM document_images WHERE document_id = '<id>';
  -- Then reingest once. Or use /reextract which would handle this.
  ```

## Reference / evidence links

- `backend/app/api/documents.py` lines 643-717 (`/reingest`, missing deletes)
  vs 720-825 (`/reextract`, correct deletes at 803-811).
- Phase 071.2 D-071.2-06 (threadpool sweep refactor — partial port that
  missed the delete parity).
- This session chat: 3-reingest sequence on user's thesis showed +39/+48 +20
  per click; PDF chunks stable at 441 confirming chunks ARE cleaned via
  `_upload_pipeline` path.
