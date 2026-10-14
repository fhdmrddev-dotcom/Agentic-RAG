---
id: BUG-261012-02
title: DELETE /documents/{id} answers 500 instead of 404 when the caller owns no such row
reported: 2026-10-12
surface: Agentic-RAG
severity: minor
status: closed   # closed 2026-10-14 by Phase 280 plan 04 on live evidence
affected_areas: [backend/documents, api/errors]
folded_into: "280"
verified_closed_by: "280 (51a9e7962 — 280-LIVE-EVIDENCE.md SC#4)"
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 3ef48e78c
  date: 2026-10-12
---

# BUG-261012-02: DELETE /documents/{id} answers 500 instead of 404 when the caller owns no such row

## What we observed

Found during Phase 275's G-4 MEMBER drive (`275-G4-EVIDENCE.md` §5.3 MEMBER-7 and §5.4 OBS-1), on the
local app, 2026-10-12.

- A member sending `DELETE /documents/{id}` for a document owned by the org admin → `curl`: **HTTP 500
  Internal Server Error**; browser `fetch`: `net::ERR_FAILED` (no CORS headers on the 500).
- The org admin sending `DELETE /documents/00000000-0000-0000-0000-000000000001` (no such row) → **HTTP 500**.

Reproduce: `curl -X DELETE -H "Authorization: Bearer <any user's token>" -H "X-Org-Id: <org>"
http://127.0.0.1:8000/documents/00000000-0000-0000-0000-000000000001`.

**Expected:** `404 {"detail": "Document not found"}` (the handler already has that branch).
**Actual:** 500. Nothing is deleted and no receipt is written, so this is **not** a hold bypass or a data
risk: the row stays (SQL-checked in the drive).

## Why it matters

- A client cannot tell "not yours / not there" from "the server broke", and the browser hides the body
  entirely (CORS), so the UI can only show a generic failure.
- A 500 on an ordinary request pollutes error monitoring.
- It is reachable by any signed-in user with any id.

## Hypothesized cause

Hypothesis, by reading: `backend/app/api/documents.py:1824-1832` runs
`supabase.table("documents").select("*").eq("id", …).eq("user_id", …).maybe_single().execute()` and then
reads `doc_resp.data`. With the installed postgrest client, `maybe_single().execute()` returns `None`
(not a response object) when zero rows match, so `doc_resp.data` raises `AttributeError` before the
existing `404` branch is reached. The lines date from `f1255ee18` (2026-03-17) / `b1d676bb7` (2026-04-25);
Phase 275 did not change them (the D-32 AST fence pins that 275 added no `if` to this handler).

Not verified: whether other handlers share the `maybe_single()` → `.data` shape (worth one grep when fixed).

## Surface classification

`Agentic-RAG` — this app's documents API.

## Suggested routing

- **Fold into in-flight phase:** n/a. `backend/app/api/documents.py` is a G-5 FIRING hot file, and Phase
  275's D-32 allowed guard calls only in its delete path.
- **Defer to future phase / milestone:** G-3 sized (one file, about two lines: `if not doc_resp or not
  doc_resp.data`) → a `/gsd:fast` candidate, or the next phase whose `files_modified` names `documents.py`.
- **Plant as seed:** no.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

None needed for data safety; the request deletes nothing. Clients should treat a 500 here as "not found".

## Reference / evidence links

- `.planning/phases/275-retention-legal-hold/275-G4-EVIDENCE.md` §5.3 MEMBER-7, §5.4 OBS-1
- `backend/app/api/documents.py:1824-1833`

## Closed 2026-10-14 (Phase 280, plan 04)

Every `maybe_single()` read in `backend/app` goes through `app.utils.db.maybe_row` (fix `51a9e7962`, AST fence `test_280_maybe_row_fence.py`). Live, through real postgrest 2.29 as a signed-in user: `delete_document` for another user's document and for a random uuid both raise the identical `404 'Document not found'`. Evidence: `.planning/phases/280-in-once-out-clean/280-LIVE-EVIDENCE.md` SC#4.
