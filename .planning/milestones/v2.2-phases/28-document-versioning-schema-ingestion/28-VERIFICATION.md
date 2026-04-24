---
phase: 28-document-versioning-schema-ingestion
verified: 2026-04-12T22:43:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 28: Document Versioning Schema + Ingestion Verification Report

**Phase Goal:** Re-uploading a file with the same name creates a new tracked version rather than failing deduplication, and old chunks are immediately retired from retrieval
**Verified:** 2026-04-12T22:43:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Re-uploading a file with the same filename creates a new document row with incremented version_number | VERIFIED | `documents.py` lines 201-221: `existing_versions` query + `next_version = existing_versions.data[0]["version_number"] + 1`; insert includes `"version_number": next_version` |
| 2  | The previous version's is_latest flag is set to false after a new version is uploaded | VERIFIED | `documents.py` line 215: `.update({"is_latest": False})` scoped to user_id + filename before new insert |
| 3  | Exact-hash dedup check only matches is_latest=true rows | VERIFIED | `documents.py` line 188: `.eq("is_latest", True)` in dedup query chain |
| 4  | match_document_chunks RPC excludes chunks from documents where is_latest=false | VERIFIED | `025_document_versioning.sql` line 38: `AND d.is_latest = true` in match_document_chunks |
| 5  | keyword_search_chunks RPC excludes chunks from documents where is_latest=false | VERIFIED | `025_document_versioning.sql` line 70: `AND d.is_latest = true` in keyword_search_chunks |
| 6  | resolve_document_id returns only the latest version of a document | VERIFIED | `retrieval_service.py` lines 142, 154: `.eq("is_latest", True)` on both exact and partial match queries |
| 7  | _enrich_with_filenames includes version_number in each enriched result dict | VERIFIED | `retrieval_service.py` line 106: select includes `version_number`; line 117: `entry["version_number"] = doc.get("version_number", 1)` |
| 8  | retrieved_citations in threads.py carry version_number from search results | VERIFIED | `threads.py` line 743: `"version_number": hit.get("version_number", 1)` in search_documents citation dict |
| 9  | analyze_document citations carry version_number from fetch_full_document | VERIFIED | `threads.py` line 769: `"version_number": doc.get("version_number", 1)` in analyze_document citation dict |
| 10 | SSE citations event includes version_number field | VERIFIED | `threads.py` lines 1202-1205: `sse_c = dict(c)` copies all keys including version_number automatically |
| 11 | CitationCard renders '(v2)' suffix when version_number > 1 | VERIFIED | `CitationCard.tsx` lines 21-23: conditional renders `` `(v${citation.version_number})` `` when `version_number != null && version_number > 1` |
| 12 | CitationCard shows no version suffix when version_number is 1 or absent | VERIFIED | `CitationCard.tsx`: conditional evaluates to empty string `""` when version_number is 1 or absent |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/025_document_versioning.sql` | version_number and is_latest columns, updated RPCs | VERIFIED | EXISTS — 77 lines; contains both `ADD COLUMN IF NOT EXISTS version_number` and `ADD COLUMN IF NOT EXISTS is_latest`; both RPCs recreated with `AND d.is_latest = true` |
| `backend/app/api/documents.py` | Version creation logic replacing stale-delete logic | VERIFIED | EXISTS — contains `existing_versions`, `next_version`, `"version_number": next_version`, `"is_latest": True`; no stale `.delete().eq("id", ...)` in upload path |
| `backend/app/models/document.py` | DocumentResponse with version fields | VERIFIED | EXISTS — lines 34-35: `version_number: int = 1` and `is_latest: bool = True` |
| `backend/app/services/retrieval_service.py` | version_number in enriched results | VERIFIED | EXISTS — `_enrich_with_filenames` select includes `version_number`; enrichment loop sets `entry["version_number"]`; `resolve_document_id` filters by `is_latest=True` on both queries; `fetch_full_document` selects `version_number` |
| `backend/tests/unit/test_document_versioning.py` | Tests for version creation and dedup adjustment | VERIFIED | EXISTS — 313 lines; `TestDocumentVersioning` class with 4 tests: `test_reupload_creates_new_version`, `test_first_upload_gets_version_1`, `test_dedup_ignores_stale_version`, `test_dedup_matches_latest_version` |
| `backend/app/api/threads.py` | version_number in retrieved_citations dicts | VERIFIED | EXISTS — line 743 (search_documents path) and line 769 (analyze_document path) both include `version_number` |
| `frontend/src/types/index.ts` | version_number field on Citation interface | VERIFIED | EXISTS — line 56: `version_number?: number` added to Citation interface |
| `frontend/src/components/chat/CitationCard.tsx` | Version label rendering | VERIFIED | EXISTS — lines 21-23: conditional `(vN)` suffix rendering |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `025_document_versioning.sql` | `backend/app/api/documents.py` | version_number and is_latest columns used in upload queries | WIRED | `documents.py` queries `existing_versions` by `version_number`, updates `is_latest`, inserts with both fields |
| `backend/app/api/documents.py` | `backend/app/models/document.py` | DocumentResponse validates returned doc rows with version fields | WIRED | `DocumentResponse` at lines 34-35 includes both `version_number` and `is_latest`; insert result returned via Pydantic model |
| `backend/app/services/retrieval_service.py` | `backend/app/api/threads.py` | search_documents returns enriched results with version_number; threads.py reads it into retrieved_citations | WIRED | `_enrich_with_filenames` sets `entry["version_number"]`; `threads.py` line 743 reads `hit.get("version_number", 1)` |
| `backend/app/api/threads.py` | `frontend/src/components/chat/CitationCard.tsx` | SSE citations event carries version_number; parsed into Citation objects; rendered by CitationCard | WIRED | `dict(c)` copy at line 1202 propagates `version_number` automatically; `Citation` interface has `version_number?: number`; `CitationCard` renders `(vN)` suffix |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CitationCard.tsx` | `citation.version_number` | `threads.py` SSE citations event | Yes — flows from `documents` table via `_enrich_with_filenames` select with real DB query | FLOWING |
| `documents.py` upload | `next_version` | `existing_versions` DB query | Yes — queries `documents` table ordered by `version_number DESC LIMIT 1` | FLOWING |
| `retrieval_service.py` `_enrich_with_filenames` | `doc.get("version_number", 1)` | `supabase.table("documents").select("id, filename, metadata, version_number").in_("id", doc_ids)` | Yes — real DB query with version_number in select list | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 4 versioning unit tests pass | `pytest tests/unit/test_document_versioning.py -q` | 4 passed | PASS |
| 15 retrieval service tests pass (including 2 new version propagation tests) | `pytest tests/unit/test_retrieval_service.py -q` | 15 passed | PASS |
| 19 total backend tests pass without regressions | `pytest tests/unit/test_document_versioning.py tests/unit/test_retrieval_service.py -q` | 19 passed, 0 failed | PASS |
| CitationCard component tests pass (7 tests) | `vitest run src/__tests__/components/CitationCard.test.tsx` | 7 passed | PASS |
| Migration SQL contains both RPC recreations with is_latest filter | `grep "d.is_latest = true" 025_document_versioning.sql` | 2 matches (one per RPC) | PASS |
| Old stale-delete code absent from upload path | `grep "storage.from_.*remove\|\.delete().*stale"` in upload context | Not found in upload path (only in separate `delete_document` endpoint) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VER-01 | 28-01-PLAN.md | User uploading a file with the same filename creates a new version rather than being rejected as a duplicate | SATISFIED | `documents.py` creates new version row with `version_number = existing + 1`; dedup only short-circuits on exact content hash match for `is_latest=True` rows |
| VER-02 | 28-01-PLAN.md | Old document chunks are immediately excluded from all retrieval and search after a new version finishes ingesting | SATISFIED | Migration 025 adds `AND d.is_latest = true` to both `match_document_chunks` and `keyword_search_chunks` RPCs; `is_latest=False` set on old version before new version is inserted |
| VER-06 | 28-02-PLAN.md | Answers citing a versioned document include the version number in the citation (e.g. "Report.pdf (v2) — Section 3") | SATISFIED | version_number flows from documents table through `_enrich_with_filenames` -> `retrieved_citations` -> SSE citations event -> `CitationCard` renders `(vN)` when N > 1 |

**Orphaned requirement check:** REQUIREMENTS.md lists VER-03, VER-04, VER-05 under Phase F-02 (Document Versioning) but these are explicitly marked `[ ]` (incomplete) and assigned to future phases. No plan in phase 28 claimed them, and they are not expected to be delivered here.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO, FIXME, placeholder comments, or stub implementations found in any of the 8 phase 28 files. The `delete()` + `storage.from_().remove()` calls at `documents.py` lines 319-323 are inside the separate `delete_document` endpoint (not the upload path) and are intentional hard-delete functionality.

### Human Verification Required

#### 1. Version Badge Renders Correctly in Browser

**Test:** Upload `report.pdf`, wait for ingestion, re-upload a modified `report.pdf`, then ask a question that cites it.
**Expected:** Citation card shows "report.pdf (v2)" — the `(v2)` suffix appears inline with the filename.
**Why human:** CitationCard rendering in a live browser with real SSE citation events cannot be verified programmatically. The existing CitationCard test suite does not include a version_number > 1 test case.

#### 2. Old Chunks Excluded After Re-Upload

**Test:** Upload a document with specific content, ask a question that returns that content. Re-upload with different content for the same filename. Ask the same question.
**Expected:** Only chunks from the new version appear in the answer; content from the old version is absent.
**Why human:** Requires a live Supabase instance with the 025 migration applied and an active ingestion pipeline. Cannot verify RPC filtering without real DB state.

### Gaps Summary

No gaps. All 12 observable truths are verified against the actual codebase. All 8 required artifacts exist with substantive implementations and correct wiring. The three requirement IDs (VER-01, VER-02, VER-06) are fully satisfied. Pre-existing frontend test failures (FolderNode, FolderTree, IngestionPage, MessageItem, useDocuments) are from prior phases and unrelated to phase 28 changes — they were present before the first phase 28 commit (`042fa90`).

---

_Verified: 2026-04-12T22:43:00Z_
_Verifier: Claude (gsd-verifier)_
