---
phase: 078-backpressure-json-primitive-code-quality-bundle
fixed_at: 2026-05-27T00:00:00Z
review_path: .planning/phases/078-backpressure-json-primitive-code-quality-bundle/078-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 078: Code Review Fix Report

**Fixed at:** 2026-05-27
**Source review:** .planning/phases/078-backpressure-json-primitive-code-quality-bundle/078-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Dedup CAS catch matches any unique-constraint violation, not just `documents_dedup_idx`

**Files modified:** `backend/app/api/documents.py`
**Commit:** 2d8dcef
**Applied fix:** Removed the overly broad `or "unique" in exc_str.lower()` secondary match from the dedup exception handler at line 484. The catch now relies solely on the precise Postgres error code `"23505"`, which supabase-py always includes in APIError messages. This prevents future unique constraints on the documents table from being silently misreported as HTTP 409 "File already exists in this folder".

### WR-02: Redis exception silently swallowed in backpressure endpoint with no log

**Files modified:** `backend/app/api/admin.py`
**Commit:** b66ed8d
**Applied fix:** Replaced `except Exception: pass` with `except Exception as exc:` followed by `logger.warning(...)` that logs the exception type name. The endpoint still returns `redis_active_runs=0` when Redis is unreachable (resilience behavior unchanged per D-078-07), but ops can now distinguish healthy-zero from infrastructure-failure-zero in server logs.

## Test Verification

Ran `tests/unit/test_backpressure.py` and `tests/integration/test_documents.py::TestUploadDedup409` -- all 6 tests passed. One pre-existing failure in `TestUploadDocument::test_upload_with_valid_folder_id_returns_201` (KeyError at line 396, unrelated to the fix scope) was confirmed not introduced by these changes.

---

_Fixed: 2026-05-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
