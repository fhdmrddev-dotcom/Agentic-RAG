---
phase: quick
plan: 260411-wj5
subsystem: backend
tags: [bug-fix, skills, file-upload, storage, binary-extraction]
dependency_graph:
  requires: []
  provides: [guarded-storage-upload, binary-skill-file-reading]
  affects: [backend/app/api/skills.py, backend/app/api/threads.py]
tech_stack:
  added: []
  patterns: [try/except storage guard, extension-based dispatch, lazy library import]
key_files:
  modified:
    - backend/app/api/skills.py
    - backend/app/api/threads.py
decisions:
  - "Catch all Exception in storage upload guard — StorageException is a subclass and not currently imported at top of skills.py"
  - "upsert: 'true' as string (not bool) — matches Supabase storage REST API expectation"
  - "Lazy import of docx/openpyxl/pptx inside handler — avoids loading on every request"
  - "Unknown binary type returns JSON error string — clear signal to LLM without crashing"
metrics:
  duration: "3 minutes"
  completed_date: "2026-04-11"
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 260411-wj5: Fix Skill File Upload and Binary File Reading Summary

**One-liner:** Guarded storage upload with upsert prevents orphaned DB records; extension-dispatched extraction replaces bare UTF-8 decode for .docx/.xlsx/.pptx skill files.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix storage upload in upload_skill_file | e9bafbc | backend/app/api/skills.py |
| 2 | Fix read_skill_file binary extraction | f69e171 | backend/app/api/threads.py |

## What Was Done

### Task 1 — skills.py: Guarded storage upload with upsert

The `upload_skill_file` endpoint was calling `supabase.storage.from_("skill-files").upload()` without any error handling. If storage raised `StorageException` (e.g., duplicate path conflict), the exception propagated uncaught OR was silently swallowed, but the DB insert for `skill_files` always ran regardless — creating orphaned metadata rows with no backing bytes.

Fix:
- Wrapped the upload call in `try/except Exception` that raises `HTTP 500` with a descriptive message on failure
- Added `"upsert": "true"` to `file_options` so re-uploading the same filename to the same path overwrites instead of failing
- Moved the `skill_files` DB insert to after the try/except block so it only executes when upload succeeded

### Task 2 — threads.py: Extension-based text extraction in read_skill_file

`read_skill_file` was decoding all downloaded bytes as UTF-8, which produces garbage for Office binary formats. The libraries to handle them (python-docx, openpyxl, python-pptx) were already in requirements.txt.

Fix:
- Added `import io` at module level (needed for `io.BytesIO` wrapper)
- Added extension-based dispatch after downloading raw bytes:
  - `.docx` — python-docx paragraph extraction
  - `.xlsx` — openpyxl tab-separated cell values (all sheets)
  - `.pptx` — python-pptx shape text extraction (all slides)
  - `.txt`, `.md`, `.py`, `.csv`, `.json`, `.yaml`, `.yml`, `.toml`, `.html`, `.xml`, `.rst`, `.log` — unchanged UTF-8 decode
  - Unknown/binary — returns a clear JSON error string the LLM can relay to the user

## Verification

Both automated checks passed:
- `upload()` wrapped in try/except: PASS
- Extension dispatch tokens present and `import io` in top 35 lines: PASS
- `from app.api.skills import router; from app.api.threads import router` — Import OK

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `backend/app/api/skills.py` — modified (upload guard + upsert)
- `backend/app/api/threads.py` — modified (import io + extension dispatch)
- Commits e9bafbc and f69e171 verified in git log
