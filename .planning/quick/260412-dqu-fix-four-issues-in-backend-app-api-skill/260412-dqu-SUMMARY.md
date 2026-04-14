---
phase: quick-260412-dqu
plan: "01"
subsystem: backend/skills-export
tags: [skills, export, zip, mime-routing, agentskills]
dependency_graph:
  requires: []
  provides: [correct-skill-zip-export]
  affects: [backend/app/api/skills.py]
tech_stack:
  added: []
  patterns: [re.sub slug derivation, YAML frontmatter metadata block]
key_files:
  created: []
  modified:
    - backend/app/api/skills.py
decisions:
  - "URL-safe slug uses re.sub('[^a-z0-9-]+') for correctness over simple .replace(' ', '-').lower()"
  - "compatibility field is human-readable requirement string, not a version number"
  - "ZIP root folder named after slug per agentskills.io format"
metrics:
  duration: "~4 min"
  completed: "2026-04-12"
  tasks_completed: 2
  files_modified: 1
---

# Quick Task 260412-dqu Summary

**One-liner:** Four targeted fixes to skills.py: expanded MIME routing for office/PDF/ZIP/binary to assets/, URL-safe slug via re.sub, frontmatter metadata block with original_name and human-readable compatibility, and all ZIP entries wrapped under slug/ root folder.

## Tasks Completed

| # | Task | Commit | Result |
|---|------|--------|--------|
| 1 | Fix _mime_to_subdir and add re import | 90ee427 | All 9 assertions passed |
| 2 | Fix export_skill slug, frontmatter, and ZIP root folder | 785e23f | All assertions passed, Syntax OK |

## Changes Made

### Task 1 — `_mime_to_subdir` + `import re`

- Added `import re` at module top (alongside `import io`, `import os`)
- Added new branch before `return "references"` that routes to `"assets"` for:
  - `application/vnd.openxmlformats-officedocument.*` (DOCX, XLSX, PPTX)
  - `application/pdf`
  - `application/zip`
  - `application/octet-stream`
- Plain text types (`text/plain`, `text/markdown`, `text/csv`, `text/html`) continue falling through to `"references"` unchanged

### Task 2 — `export_skill` function

1. **Slug derivation** — Moved earlier (right after `skill_row` assignment), changed from `name.replace(" ", "-").lower()` to `re.sub(r'[^a-z0-9-]+', '-', skill_row["name"].lower()).strip('-')` — handles special characters, not just spaces
2. **Frontmatter dict** — `name` now uses slug; added `metadata` block with `version` and `original_name`; `compatibility` changed from version string `"1.0"` to human-readable `"Requires execute_code tool with Docker sandbox and python-docx"`
3. **ZIP root folder** — Both `zf.writestr` calls prefixed with `f"{slug}/"`: `SKILL.md` becomes `slug/SKILL.md`, files become `slug/subdir/filename`
4. **Old slug line removed** — Trailing `slug = skill_row["name"].replace(" ", "-").lower()` after `buf.seek(0)` removed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `backend/app/api/skills.py` exists and is modified
- Commit 90ee427 exists (Task 1)
- Commit 785e23f exists (Task 2)
- All verification assertions passed
- Syntax OK
