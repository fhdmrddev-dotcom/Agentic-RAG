---
phase: 151-agent-file-tools
plan: 03
subsystem: api
tags: [upload, validation, magic-bytes, workspace, ooxml, file-picker, security]

# Dependency graph
requires:
  - phase: 100-ephemeral-template-upload
    provides: "validate_ooxml magic-byte gate + upload_template route + TemplateUpload.tsx + conftest OOXML/renamed-binary/oversize fixtures"
provides:
  - "Generalized validate_upload — the mid-chat upload gate widened beyond OOXML (D-09) to text-ish (.md/.json/.csv/.txt/.py/.js/.sh) + image (.png/.jpg/.jpeg/.gif/.webp) skill assets"
  - "Per-category content validation: OOXML ZIP branch (verbatim) + utf-8-decodable/NUL-reject text branch + leading-magic-byte image branch"
  - "DoS/office-bomb size guard trips BEFORE any parse for every widened type (T-151-03-02)"
  - "TemplateUpload.tsx accept= widened in lockstep with _ALLOWED_EXT"
  - "validate_ooxml retained as a behavior-preserving alias (Phase-100 callers unbroken)"
affects: [151-04-attach-skill-file, FILE-01, workflow-run-inputs, upload-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-category upload validator: extension allowlist → size guard first → branch by category (OOXML/text/image)"
    - "Widen-in-place + backward-compat alias (validate_ooxml = validate_upload) — mirrors upload_workspace_template alias"
    - "Frontend accept= kept in lockstep with the backend _ALLOWED_EXT source of truth"

key-files:
  created:
    - "backend/tests/unit/test_151_upload_allowlist.py"
  modified:
    - "backend/app/api/workspace.py"
    - "frontend/src/components/panel/TemplateUpload.tsx"

key-decisions:
  - "Text-ish validation = NUL-free + utf-8-decodable (renamed binaries carry NUL / invalid utf-8 → refused)"
  - "Image validation = leading magic bytes only (\\x89PNG / \\xFF\\xD8\\xFF / GIF8 / RIFF..WEBP)"
  - "Size guard runs FIRST for every type, before any decode/parse (office-bomb DoS survives the widen)"
  - "Kept validate_ooxml as an alias rather than a hard rename — preserves Phase-100 test_workspace_template.py (out-of-scope regression avoided)"

patterns-established:
  - "Category-branched magic-byte upload validator (workspace.py validate_upload)"
  - "kind='template_input' untrusted provenance survives allowlist widening — never routed to the docxtpl Jinja engine (T-151-03-03)"

requirements-completed: []  # FILE-01 spans plans 03+04; closes at phase verify-work/secure-phase (false-green avoidance, 148/149/150 convention)

# Metrics
duration: 6min
completed: 2026-07-13
---

# Phase 151 Plan 03: SC#3 Upload-Widen Summary

**The mid-chat template upload gate generalized from OOXML-only to real skill assets (scripts, .md/.json/.csv/.txt, images) via a per-category magic-byte/content validator that preserves the size-guard DoS defense and the untrusted `template_input` provenance.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-13T20:50:48Z
- **Completed:** 2026-07-13T20:56:17Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `validate_ooxml` → `validate_upload`: `_ALLOWED_EXT` widened from `{.docx,.pptx,.xlsx}` to add text-ish (`.md/.json/.csv/.txt/.py/.js/.sh`) and image (`.png/.jpg/.jpeg/.gif/.webp`) types (D-09), each with its own content gate.
- The OOXML branch is preserved verbatim (extracted into `_validate_ooxml_container`); text-ish uses NUL-reject + utf-8-decode; images verify leading magic bytes — a renamed binary uploaded as `.md`/`.png` is still refused (T-151-03-01).
- The `len(raw) > MAX_FILE_SIZE` guard trips BEFORE any parse for every type (T-151-03-02); `kind='template_input'` provenance and the WR-05 filename sanitize are untouched (T-151-03-03).
- `TemplateUpload.tsx` `accept=` widened in lockstep with the backend allowlist; frontend `vite build` exit 0.
- `threads.py` untouched (G-5).

## Task Commits

Each task committed atomically (TDD RED → GREEN):

1. **Task 1: Wave 0 — widened-allowlist validator tests (RED)** - `bccb6156` (test)
2. **Task 2: Generalize validate_ooxml → validate_upload + lockstep accept= (GREEN)** - `f8744a58` (feat)

_Task 2 folded the frontend `accept=` widen (a one-line data change, no separate RED) into the GREEN commit per the plan's single-task framing._

## Files Created/Modified
- `backend/tests/unit/test_151_upload_allowlist.py` (created) - 21 tests: accept .docx + text-ish + images; reject renamed-binary/wrong-magic, oversize-for-every-type, unknown/absent ext.
- `backend/app/api/workspace.py` (modified) - `validate_upload` + `_validate_ooxml_container`/`_looks_like_text`/`_image_magic_ok` helpers; `_OOXML_EXT`/`_TEXT_EXT`/`_IMAGE_EXT` sets; `validate_ooxml` alias; call site updated in `upload_template`.
- `frontend/src/components/panel/TemplateUpload.tsx` (modified) - widened `accept=`; stale "OOXML-only"/`validate_ooxml` doc comment corrected.

## Decisions Made
- **Alias over hard rename:** the plan said "rename/generalize validate_ooxml → validate_upload", but `backend/tests/test_workspace_template.py` (Phase 100) imports `validate_ooxml`. Kept `validate_ooxml = validate_upload` as a behavior-preserving alias (`validate_upload` is a strict superset for the three OOXML types) rather than break those 17 tests. Mirrors the existing `upload_workspace_template = upload_template` alias convention in the same module.
- **Text NUL-reject heuristic:** any NUL byte OR a utf-8 decode failure → refuse. Source/text files never legitimately contain NUL; this catches the `renamed_binary_bytes` MZ/PE fixture uploaded as `.md`.
- **Oversize proof isolates the size guard:** tests use valid-content-but-oversized payloads (`b"a"*(MAX+1)` for text, valid-PNG-magic + padding for images) so ONLY the size guard can reject them — proving the DoS guard runs before content validation for the widened types.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved `validate_ooxml` as a backward-compat alias**
- **Found during:** Task 2 (generalize validate_ooxml → validate_upload)
- **Issue:** A hard rename would break `backend/tests/test_workspace_template.py` (Phase 100), which imports `validate_ooxml` from `app.api.workspace` — an out-of-scope regression introduced by this task's change.
- **Fix:** Added `validate_ooxml = validate_upload` (alias). `validate_upload` returns the identical canonical ext + 422 semantics for `.docx/.pptx/.xlsx`, so the alias is behavior-preserving.
- **Files modified:** backend/app/api/workspace.py
- **Verification:** `test_workspace_template.py` 17/17 green alongside the 21 new tests (38 total).
- **Committed in:** f8744a58 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The alias prevents a self-introduced regression while delivering the exact widen the plan specified. No scope creep — `threads.py` untouched, no new endpoint, no new dependency.

## Issues Encountered
None — RED confirmed via clean ImportError; GREEN passed on first implementation.

## Verification Evidence
- `pytest tests/unit/test_151_upload_allowlist.py tests/test_workspace_template.py` → 38 passed (21 new + 17 Phase-100 regression).
- `grep template_input backend/app/api/workspace.py` → provenance preserved (`kind="template_input"` at the route).
- `grep MAX_FILE_SIZE backend/app/api/workspace.py` → size guard at line 197 inside `validate_upload`, before any parse.
- `git diff --name-only` → does NOT include `backend/app/api/threads.py` (G-5 held).
- `cd frontend && npx vite build` → exit 0.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The widened gate is live: a user can hand `.md/.json/.csv/.py/.png` (and OOXML) to the agent mid-chat via `TemplateUpload` → `POST /workspace/files`; the file lands with `kind='template_input'`.
- Plan 151-04 (FILE-01 `attach_skill_file`) consumes these workspace files as source #1 (`_get_file_content`) — this plan only widened the door.
- Live SC#10 4-axis UAT (authored in 151-VALIDATION.md) + secure-phase close FILE-01 at verify-work.

## Self-Check: PASSED

- FOUND: backend/tests/unit/test_151_upload_allowlist.py
- FOUND: backend/app/api/workspace.py (modified)
- FOUND: frontend/src/components/panel/TemplateUpload.tsx (modified)
- FOUND commit: bccb6156 (test RED)
- FOUND commit: f8744a58 (feat GREEN)

---
*Phase: 151-agent-file-tools*
*Completed: 2026-07-13*
