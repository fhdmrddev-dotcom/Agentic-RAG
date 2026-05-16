---
phase: 072-multimodal-lift-docx-completeness
plan: 03
subsystem: backend-api
tags: [phase-072, reextract, retry-empty, d-072-03, d-072-04, rag-mm-lift-01, partial]
status: partial
verdict: contract-verified-effectiveness-deferred

# Dependency graph
requires:
  - phase: 072 Plan 01 (Multimodal Lift — App-Settings Reads + Shared Downscale Helper)
    provides: shared `_downscale_b64_for_vision(b64_png, max_edge=MULTIMODAL_THUMBNAIL_MAX_EDGE) -> str` helper at module scope; `app_settings.multimodal_max_*` reads inside `describe_image`; **persist-empty-rows contract** (rows materialize with `description=''` instead of being dropped on vision failure — this is what makes the retry endpoint meaningful).
  - phase: 072 Plan 02 (Content-Hash Dedup + DOCX Location Labels)
    provides: deduped image storage path so the retry helper only iterates unique rows; bbox.location annotation that lives independent of description (not invalidated when description is empty).
  - phase: 071 D-071-09..12 (`/reextract` route shape)
    provides: ReextractRequest body schema; full delete-cascade + re-extract behavior that the retry branch short-circuits past.
provides:
  - **`POST /documents/{id}/reextract?retry_empty_descriptions_only=true`** query param on the existing `/reextract` route — when `true`, skips the delete-cascade + re-extract entirely and ONLY refills `document_images` rows where `description='' AND created_at < now() - 5min`. When `false` (default), legacy delete-cascade + re-extract path runs unchanged.
  - **`_reextract_refill_empty_descriptions(*, supabase, document_id, user_id, app_settings, raw, mime_type) -> DocumentResponse`** async helper at `backend/app/api/documents.py:732` — runs the refill-only logic; injected `app_settings` (BLOCKER 3 — loaded once in the route fork via `run_in_threadpool(load_app_settings)`, never re-loaded inside the loop); every `.execute()` wrapped in `run_in_threadpool` per D-v2.5-01.
  - **5-minute thrash-guard** on the empty-row SELECT — prevents the retry endpoint from being used as a busy-poll loop while a fresh ingest is still mid-flight.
  - **Integration test** `test_reextract_retry_empty_descriptions_only_branch` locks 7 contract assertions: 202 status, no composer call, no ingest call, `load_app_settings` called exactly once, 2x downscale via shared helper, 2x describe_image, composite-key matched b64s, injected sentinel.
  - **Phase 072 UAT scoreboard** at `.planning/phases/072-multimodal-lift-docx-completeness/072-HUMAN-UAT.md` — captures live UAT results across the four sections.
affects:
  - **RAG-MM-LIFT-01 (PDF figure coverage ≥80%)** — Plan 03 closes the *operational* half of this requirement (cheap retry path for when vision-LLM hiccups produce empties) but the *raw recall* half remains DEFERRED to SEED-021 spike. The retry endpoint's **effectiveness on dispatcher-era documents is BLOCKED by Gap 2** (engine mismatch — see Gaps below).
  - **D-072-03 (persist empty rows)** — Plan 03 is the consumer of Plan 01's persist-empty contract. End-to-end loop closed at the route level; refill effectiveness still pending Gap 2.
  - **D-072-04 (cheap retry endpoint shape)** — endpoint shape shipped (query param + helper + test). Refill semantics need Gap 2 fix to be production-useful.

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route-level fork for cheap-retry behavior — `if retry_empty_descriptions_only: return await _reextract_refill_empty_descriptions(...)` at `documents.py:1008` short-circuits BEFORE the delete-cascade. Keeps the helper isolated; legacy callers see zero behavior change."
    - "Lazy import inside async helper — `from app.services.multimodal_service import (_downscale_b64_for_vision, describe_image, extract_docx_images, extract_pdf_images)` lives INSIDE the helper (line 778) rather than at module top. Avoids circular-import risk + makes the helper's deps explicit at the call site."
    - "Composite-key match on `(image_index, page)` — fresh_by_loc dict keyed by tuple, robust to extractor scan-order drift within the same engine. NOTE: does NOT survive cross-engine indexing (Gap 2)."
    - "Client-side cutoff computation for PostgREST filter literal — `cutoff_iso = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()` then `.lt('created_at', cutoff_iso)`. PostgREST does NOT evaluate filter values as SQL; SQL expressions like `now() - interval` get rejected as `22007 invalid input syntax`. Surfaced live during UAT, not by the mocked unit test."

key-files:
  created:
    - "`.planning/phases/072-multimodal-lift-docx-completeness/072-HUMAN-UAT.md` — UAT scoreboard, 4 sections, partial verdict"
    - "`.planning/reported-bugs/reextract-orphan-chunks-survive-reingest.md` — new bug report (Gap 3 — separate code path from Plan 03 itself, surfaced incidentally during this UAT)"
  modified:
    - "`backend/app/api/documents.py` — NEW `_reextract_refill_empty_descriptions` helper (line 732+), MODIFIED `reextract_document` route to add `retry_empty_descriptions_only: bool = Query(default=False)` and the route-level fork (line 1008+); HOTFIX (commit d29f068) `cutoff_iso` computation replaces `'now() - interval ...'` SQL-string filter literal."
    - "`backend/tests/integration/test_documents.py` — NEW `test_reextract_retry_empty_descriptions_only_branch` test in `TestReextractDocument` (+154 LOC, 7 contract assertions)."

# Commits
commits:
  - "d7ec473 feat(072-01): swap _MAX_VISION_CALLS/_MAX_B64_BYTES for app_settings reads + add shared `_downscale_b64_for_vision` helper"
  - "  ↑ that one is actually Plan 01's first commit — listed here for clarity that Plan 03 builds on Plan 01's shared helper invariant"
  - "d7ec473 feat(072-03): add retry_empty_descriptions_only query param + branch + `_reextract_refill_empty_descriptions` helper on `/reextract` (BLOCKER 1 created_at, BLOCKER 3 injected app_settings, WARNING 3 shared downscale, WARNING 4 composite key)"
  - "3d6dc99 test(072-03): integration test `test_reextract_retry_empty_descriptions_only_branch` — locks 7 contract assertions"
  - "4694481 docs(072-03): UAT scoreboard skeleton (executed AHEAD of checkpoint Task 3 so operator has the form to fill in)"
  - "d29f068 fix(072-03): compute 5-min cutoff client-side instead of passing SQL expression to PostgREST (hotfix during UAT — Gap 1 closed)"

---

# Phase 072 Plan 03 — Cheap Retry Endpoint (PARTIAL)

## What shipped

A new query-param branch on `POST /documents/{id}/reextract` that operators can use after a vision-LLM outage to refill empty image descriptions without nuking text, tables, or non-empty image rows. The endpoint contract is verified — it returns 202, skips the delete-cascade, leaves chunks untouched. **One bug was caught and fixed live during UAT**; **one bug remains open** and is routed to Phase 072.1 gap closure.

## UAT outcome (drove via orchestrator, no .env edits, no uvicorn restarts)

**Setup:** operator's thesis DOCX (58 images, dispatcher-era zip_xpath_docx storage).

**The cheap-retry contract holds:**
- Endpoint accepts the new query param without breaking the legacy path
- Returns 202 in ~1s (vs ~3-5 min for full re-extract)
- Does NOT delete chunks (`chunks=404` unchanged across the retry call)
- Does NOT re-run the chunker (no new chunk timestamps post-retry)
- Does NOT touch text or tables

**The refill effectiveness is blocked by Gap 2:** on this DOCX, the retry helper refilled 0 of 58 empty rows because it uses the legacy `extract_docx_images` (python-docx `inline_shapes` only) which returns `[]` on a DOCX where all images come from the new `zip_xpath_docx` engine (header/floating/footer). The helper hits the "no images re-extracted" branch and returns without touching any row.

## Gaps

### Gap 1 — PostgREST filter bug *(CLOSED in-band)*
PostgREST returns `22007 invalid input syntax` when given `"now() - interval '5 minutes'"` as a filter literal — it doesn't evaluate filter values as SQL expressions. Fixed by computing the cutoff client-side and passing an ISO 8601 string. Commit `d29f068`. Existing integration test still passes (mocked supabase-py never exercised the PostgREST layer — that's the test gap that let this slip).

### Gap 2 — Retry-helper engine dispatch *(OPEN — Phase 072.1)*
Helper hardcoded legacy `extract_pdf_images` / `extract_docx_images` from `multimodal_service.py`. These predate the per-aspect dispatcher and don't match the rows actually populated by `pymupdf_full_images_pdf` / `zip_xpath_docx` engines. Composite-key `(image_index, page)` matcher fails because indices don't align across engines. Fix: helper should read `app_settings.extraction_image_engine_*` and dispatch via `extract_composable(raw, mime_type, engines={"images": configured})`. Add a non-mocked integration test that exercises the full PostgREST + dispatcher path.

### Gap 3 — Orphan chunks from `/reextract` → subsequent `/reingest` *(OPEN — separate Phase 072.1 plan)*
Surfaced incidentally during this UAT. Operator's DOCX has `documents.chunk_count=402` but `document_chunks` table holds 864 rows — 462 orphaned from a prior `/reextract` operation that wasn't cleaned up by the subsequent `/reingest`. Reported at `.planning/reported-bugs/reextract-orphan-chunks-survive-reingest.md`. Not a Plan 03 bug per se, but uncovered by the Plan 03 UAT flow.

## Why we're shipping Plan 03 as PARTIAL rather than blocking on full closure

1. **The endpoint contract is the binding piece.** The cheap-retry path EXISTS, is callable, and correctly skips the cascade. Effectiveness will land via Phase 072.1 in <1 plan.
2. **No regression in the default `/reextract` path** — non-retry calls go through the unchanged delete-cascade flow.
3. **Plans 01 + 02 are fully verified** (58/58 DOCX descriptions, 67/67 PDF descriptions, all bbox.location labels present, 29 pytests green). The phase delivers most of its value even with Plan 03's effectiveness deferred.
4. **Gap closure is cheaper as a focused 1-plan phase** than as a debug-and-rewrite inside Plan 03 under fatigue. Gives a clean slot to add the non-mocked integration test that should have caught both Gap 1 and Gap 2.

## Self-check

- All non-checkpoint tasks executed: Task 1 (feat), Task 2 (test), Task 4 (UAT skeleton)
- Task 3 (live UAT) executed by orchestrator + operator collaboration; produced this scoreboard + the gap routing
- 4 commits on `v2.5-dev`: `d7ec473`, `3d6dc99`, `4694481`, `d29f068`
- SUMMARY.md created (this file)
- STATE.md / ROADMAP.md / REQUIREMENTS.md — updated by orchestrator close-out, NOT by Plan 03 itself

## Next phase routing

`/gsd:plan-phase 072 --gaps` — reads `072-VERIFICATION.md` (written alongside this SUMMARY), generates Phase 072.1 plans for Gap 2 and Gap 3.

## Self-Check: PASSED-PARTIAL
