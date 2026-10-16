---
title: Pagination
slug: api/concepts/pagination
section: api
audience: developer
status: written
release: shipped
covers: [H46]
summary: >-
  Document lists come back one page at a time in the same envelope — documents, total, offset and
  limit — where total is the exact count. GET /documents changed from an array to that envelope in
  v4.6; page with offset and limit until offset reaches total.
nearest: api/concepts/authentication
reviewed: 2026-10-16
---

Lists of documents come back **one page at a time**. Every one of them uses the same envelope, so
one loop pages any of them.

## The envelope

```json
{
  "documents": [ { "id": "…", "filename": "report.pdf", "…": "…" } ],
  "total": 10000,
  "offset": 0,
  "limit": 25
}
```

| Field | Meaning |
|---|---|
| `documents` | The rows of this page, at most `limit` of them. |
| `total` | The **exact** number of rows that match your request, across every page. It is counted by the database. It is never the length of the page. |
| `offset` | How many rows were skipped before this page. |
| `limit` | The page size that was applied. |

`GET /documents` and `POST /document-search` both answer in this shape. The per-document lists use
the same three numbers next to their own rows: `GET /documents/{document_id}/chunks` returns
`{chunks, total, offset, limit}`, and `/tables`, `/images` and `/versions` do the same with
`tables`, `images` and `versions`.

## Paging

Send `offset` and `limit`, then keep asking for the next page until `offset` reaches `total`:

```python
offset, limit = 0, 200
while True:
    page = get("/documents", params={"offset": offset, "limit": limit})
    handle(page["documents"])
    offset += limit
    if offset >= page["total"]:
        break
```

| Endpoint | `limit` default | `limit` maximum |
|---|---|---|
| `GET /documents` | 25 | 200 |
| `POST /document-search` (in the body) | 25 | 100 |
| `GET /documents/{document_id}/chunks` | 200 | 500 |
| `GET /documents/{document_id}/tables` | 50 | 200 |
| `GET /documents/{document_id}/images` | 100 | 200 |
| `GET /documents/{document_id}/versions` | 50 | 200 |

`offset` must be 0 or more. A `limit` above the maximum, or below 1, is a `422`.

Pages are ordered newest first, with the document id as a tiebreaker, so a page boundary is
stable: walking every page returns every row exactly once while nothing is being added or
removed. If documents arrive while you page, re-read `total` on each page rather than trusting
the first one.

`GET /documents` also takes filters, and `total` counts the filtered set: `folder_id` (a folder
id, or `root` for documents in no folder), `include_archived` (default `false`), `status`
(`in_flight`, `completed`, `failed` or `done`) and `order` (`created_desc`, the default, or
`updated_desc`).

## The v4.6 breaking change to `GET /documents`

**`GET /documents` used to return a JSON array. Since v4.6 it returns the envelope above.**

The array was silently cut at 1,000 rows: a library with 10,000 documents came back as 1,000 with
no error and no hint that more existed. Returning a shorter array would have hidden the same
problem, so the shape changed on purpose and loudly.

To migrate:

1. Read the rows from `response["documents"]` instead of the response itself.
2. Use `response["total"]` for counts. Never count the rows you received.
3. If you need every document, page with `offset` and `limit` as shown above.

One document by id is `GET /documents/{document_id}`. It answers `404` for a document you cannot
see, the same as for one that does not exist (see [Errors](/docs/api/concepts/errors)).

## Totals are exact

A `total` is a count of the same request, made by the database. It does not stop at 1,000, and it
does not depend on the page size. If you need only the count, ask for `limit=1` and read `total`.
