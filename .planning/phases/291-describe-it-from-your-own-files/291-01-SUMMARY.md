---
phase: 291-describe-it-from-your-own-files
plan: 01
subsystem: workflow-authoring
tags: [workflow-authoring, describe-door, pdf, acroform, docx, security, stateless-door]
requires: []
provides:
  - "backend/app/services/describe_files.py — ONE AcroForm reader + acroform_oracle, read_describe_file arms, Word fillable copy (make_fillable_copy, count_token_occurrences, place_anchor), reference caps, server sentences"
  - "POST /workflows/describe/read (stateless) → DescribeReadResponse"
  - "POST /workflows/{definition_id}/reference → ReferenceAssetRef"
  - "POST /workflows/{definition_id}/template widened: .pdf + optional anchors (Word fillable copy)"
  - "GET /workflows/{definition_id}/template/placeholders: .pdf arm (AcroForm names, document order)"
  - "workflow_wire: DescribeField, DescribeUnplaced, DescribeReadResponse, ReferenceAssetRef, WordAnchorIn, _DESCRIBE_MIME_BY_EXT"
  - "docs/HOT-FILE-LEDGER.md rows + sections for the 12 files phase 291 touches or creates"
affects:
  - "291-02 (generate path consumes DescribeReadResponse text/fields; describe_draft_guards)"
  - "291-03 (_template_oracle calls describe_files.acroform_oracle)"
  - "291-04 / 291-05 (client renders the arms and the server sentences verbatim)"
tech-stack:
  added: []
  patterns:
    - "stateless file read door (193.1 shape): bytes in, arm out, no client/pool/id/path"
    - "AI names spots, server places them; exactly-once re-read after writing the copy"
    - "async proposer reached from the threadpool via anyio.from_thread.run"
key-files:
  created:
    - backend/app/services/describe_files.py
    - backend/tests/unit/test_291_describe_read.py
    - backend/tests/unit/test_291_word_copy.py
    - backend/tests/unit/test_291_describe_read_door.py
  modified:
    - docs/HOT-FILE-LEDGER.md
    - backend/app/api/workflow_authoring_doors.py
    - backend/app/api/workflow_wire.py
    - backend/app/api/workflows.py
    - backend/tests/unit/test_286_workflows_seam_pins.py
    - backend/tests/unit/test_256_finish_run_unchanged.py
    - backend/tests/unit/test_256_judge_usage_counted.py
    - backend/tests/fixtures/phase286/workflows_openapi.json
    - backend/tests/fixtures/phase286/workflows_routes.json
    - backend/tests/fixtures/phase286/workflows_moved_ast.json
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
decisions:
  - "The async field proposal runs on the request's own loop: the door passes a sync wrapper that calls anyio.from_thread.run, and read_describe_file stays synchronous inside run_in_threadpool"
  - "read_describe_file raises DescribeFileUnreadable for bytes that never opened (the door's 422); every other reader returns a value or None"
  - "/describe/read is registered just before POST /{definition_id}/publish (the first /{definition_id} pattern), so _EXPECTED_ROUTES order is: ... grounding-bundle, describe/read, {id}/publish ..."
  - "Three server sentences were added beyond the plan's four (bad key, blank already used, key reused) so no refusal is worded as a split blank it is not"
  - "Form-role reads also carry the file's text (capped, cut_short when cut) so 291-02 can send it to /generate without re-reading bytes (RESEARCH Pitfall 11)"
  - "The zip-bomb cap also applies on the template door when anchors are sent (the copy maker opens the container) and on the reference door for .docx"
metrics:
  duration: "~2h (incl. two full backend gates at head and one at base)"
  completed: 2026-10-22
  tasks: 3
  files: 16
---

# Phase 291 Plan 01: Describe-door file read and bind doors Summary

One pure leaf (`describe_files.py`) reads an attached form, template or reference before any draft exists: exact AcroForm fields with their types carried over, today's `{{ }}` template read, AI-proposed fields for Word blanks and flat or scanned PDFs (scans through `vision_text` with a 3-page cap), an honest "none", and capped reference text. A Word blanks form becomes a server-made fillable copy whose ticked keys each appear exactly once as `{{ key.value }}`. Four doors expose it: a stateless `POST /workflows/describe/read`, a widened template bind (fillable PDF, Word copy), a reference bind, and a PDF arm on the owner-gated re-read.

## What was built

**Task 1 (ledger + reader leaf).**
- `docs/HOT-FILE-LEDGER.md`: 12 scan-list rows and sections. Six existing files had no row (triples re-derived from git: `template_render_service.py` 8/3/988 **FIRES**, `DescribeTemplateRow.tsx` 1/1/276, `TemplateAttachSection.tsx` 3/1/403, `templateFirstVocabulary.ts` 1/1/238, `useDraftPersistence.ts` 15/1/1081, `useTemplatePlaceholders.ts` 1/0/154). The other six are files the phase creates, entered as `0 / 0 / 0` young rows that name the creating plan. `node scripts/check-hot-file-ledger.cjs .planning/phases/291-describe-it-from-your-own-files` went from exit 1 (9 missing) to exit 0.
- `read_acroform_fields` walks `/AcroForm /Fields`. It joins `/T` into fully qualified names (non-terminal parents are not listed) and reads `/FT` and `/Ff` (radio bit 16, pushbuttons skipped), button states from `/AP /N` with the leading slash kept (`/Off` added for checkboxes and stripped for radios), `/Opt` export values, `/TU`, the widget rect and the page. Not a PDF, no AcroForm, or corrupt bytes give `None`.
- Labels are taken in this order: `/TU`, then the nearest PyMuPDF words on the same line to the left, then the line directly above (horizontal overlap required), then the injected proposer, which is called only for fields still without a label. The key stays `exact`.
- Types follow D-11: text → `text`, checkbox → `enum ["yes","no"]`, radio and choice → `enum` with the field's own options.
- Flat PDFs and `.txt`/`.md` forms go through the proposer. Keys must match the Jinja identifier rule, may not be in `RESERVED_RUN_INPUT_KEYS`, and the first proposal wins on a duplicate. An obvious "Date" label becomes `date`.
- Scans: `classify_pdf_deficit` → `render_pdf_pages_b64(max_pages=min(3, page_budget))` → `transcribe_pages`. An empty transcription gives `scan_unreadable`. The page cut says "Only the first 3 of 9 pages of this scan were read."
- `reference_char_cap` follows A8 (35% of the context budget × 3.5 chars ÷ 6, clamped to [8,000, 60,000], 20,000 when unresolved). The cut-short sentence is exact.
- `propose_fields_via_model` is one `forced_emit` on the authoring model. The document is fenced in the USER turn, with fence-closing sequences escaped. The `PROPOSE_TOOL` schema is hand-written with no `$ref`, and any failure returns `[]`.

**Task 2 (Word fillable copy).**
- `place_anchor` decides placement deterministically. A `line` anchor needs exactly one paragraph whose run text has the label followed by `___`. A `cell` anchor needs exactly one empty cell right of a label cell. Zero matches give the split-blank sentence; more than one gives "twice" / "N times".
- `make_fillable_copy` first refuses originals carrying `{{` or `{%` text, with the copy-refused sentence. It then opens a copy, inserts `{{ key.value }}` with the run-preserving span walk (lines are written right-to-left inside each paragraph), saves, and re-reads with `parse_docx_template_variables` and `count_token_occurrences`. A key that does not appear exactly once is dropped, and a count above one rebuilds the copy without that key. The original's md5 is unchanged, which is tested.
- The read arms `blanks` (a dry-run placement that returns `line_before` / `line_after`, the anchor and `unplaced` sentences) and `copy_refused` are wired.

**Task 3 (doors).**
- `read_describe_file(file, role, current_user)` keeps the shipped gate ladder. Reference role refuses `.pptx`/`.xlsx`. `validate_upload` checks magic bytes. The zip cap applies to `.docx/.pptx/.xlsx` only. A parse failure is a 422 "The document could not be read.", never an arm. The filename is echoed sanitised. Settings come from the cached `load_user_settings`, and the parse runs in `run_in_threadpool(describe_files.read_describe_file, ...)`.
- `upload_workflow_template` now accepts `.pdf` (mime `application/pdf`) and an optional `anchors` form field (a JSON list of `WordAnchorIn`, at most 200). With anchors on a `.docx` it stores the copy, not the original. Anchors on a non-`.docx`, invalid JSON, a refused copy, or nothing placed each give a 422 with server words.
- `upload_workflow_reference` copies the template door's owner gate, ladder, safe name, user-keyed path and user-JWT Storage upload, and returns `ReferenceAssetRef`.
- `get_workflow_template_placeholders` gains one `.pdf` branch through `resolve_template_source` and `acroform_oracle`. Field names come back in document order, and missing or non-PDF bytes give `unreadable`.
- `workflows.py` gained +28 / −0: four import names and two `router.post(...)(handler)` registrations, `/describe/read` at line 1085, before the first `/{definition_id}` registration at 1102.
- The 286 pins were re-baselined deliberately, and the paragraph `DELIBERATE RE-BASELINE (Phase 291-01, 2026-10-22)` in `test_286_workflows_seam_pins.py` records the measured diffs:
  - routes: +116/−0
  - OpenAPI: +397/−1 (the one replaced line is the template door's description)
  - AST: +2/−2 (two body hashes; decorators unchanged)
  - `_MOVE_SET` is still 25
- The public OpenAPI snapshot and the filtered public doc were regenerated (+397/−1 and +393/−0).

## Verification

- `pytest tests/unit/test_291_describe_read_door.py test_193_1_stateless_placeholders.py test_286_workflows_seam_pins.py test_276_openapi_snapshot_fresh.py test_291_describe_read.py test_291_word_copy.py test_193_workflow_template_upload.py test_q5r_template_placeholders.py test_103_nl_generate.py` → 139 passed.
- `test_193_1_stateless_placeholders.py` is unchanged (`git diff --numstat` empty) and green.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/291-describe-it-from-your-own-files` → exit 0.
- `node scripts/check-extension-contract.cjs` → OK, 17 files, 0 violations.
- Acceptance greps all hold:
  - `describe_image(` in non-comment lines: 0
  - `transcribe_pages(`: 1
  - DB-client imports in the leaf: 0
  - `.value }}`: 4
  - `count_token_occurrences` is used inside `make_fillable_copy`
- Full backend unit gate (`pytest tests/unit -q --continue-on-collection-errors`), re-derived this session:
  - **Head: 70 failed, 8758 passed, 0 collection errors.**
  - **Plan base `c6eabcaa4`, in a throwaway worktree: 70 failed, 8682 passed.**
  - The failing SETS are identical (set diff empty both ways), so all 70 are inherited and the run is under the 71 ceiling.
  - The first head run read 72. The two extra were fences this plan reddened, both fixed in `5c625ad27` (Deviation 4).
  - The throwaway worktree was removed with `scripts/teardown-worktree.sh` (source venv and node_modules intact).

## TDD Gate Compliance

Each task has its `test(291-01)` RED commit before its `feat(291-01)` GREEN commit (3d6b99963 → 5a8e0ef1b, 4b8213c37 → c57a9e537, 850427a84 → e79480384). Every RED run failed for the stated reason (module or functions absent, arms not wired, routes not registered). There was one expected exception in the door RED run: `test_pdf_asset_that_cannot_be_downloaded_is_unreadable` passed at base, because the existing docx path already maps a download miss to `unreadable`. It is a behaviour-preservation control for the new `.pdf` branch, not a new behaviour. `test_the_no_client_fence_can_actually_fire` is a harness positive control and passes by design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Extra server sentences for refusals the plan's four did not cover**
- **Found during:** Task 2
- **Issue:** an invalid or reserved key, two anchors naming the same blank, and one key anchored twice would otherwise have been worded as a "split blank", which is false.
- **Fix:** added `couldnt_place_bad_key`, `couldnt_place_taken` and `couldnt_place_key_reused`, all in the same "Couldn't place “{label}”: … It stays blank in the filled copy." voice. The plan's four exact sentences are unchanged.
- **Files modified:** backend/app/services/describe_files.py
- **Commit:** c57a9e537

**2. [Rule 2 - Security] Zip-bomb cap on the bind doors where the server now opens the container**
- **Found during:** Task 3
- **Issue:** the anchors path on the template door and the `.docx` reference door parse or store OOXML. The plan required the cap only on the read door.
- **Fix:** the same `_TEMPLATE_MAX_UNCOMPRESSED_BYTES` check now runs before `make_fillable_copy`, and on reference `.docx` uploads. The plain template upload (no anchors) is unchanged.
- **Files modified:** backend/app/api/workflow_authoring_doors.py
- **Commit:** e79480384

**3. [Rule 3 - Blocking] Direct handler calls receive FastAPI's `Form(...)` default object**
- **Found during:** Task 3
- **Issue:** existing tests call `upload_workflow_template` directly without `anchors`, so the parameter arrives as a `FieldInfo` object, not `None`.
- **Fix:** anchors are treated as present only when they are a non-blank `str`, and `role` falls back to `"form"` when it is not a `str`.
- **Files modified:** backend/app/api/workflow_authoring_doors.py
- **Commit:** e79480384

**4. [Rule 1 - Bug] Two Phase 256 fences reddened by this plan's additions**
- **Found during:** the wave gate (the first full run read 72)
- **Issue:** `test_256_finish_run_unchanged` pins `await finish_run(` at `api/workflows.py:1556`. The 16 added lines above it (four import names and the `/describe/read` registration) moved the call to 1572, and the per-file COUNT is unchanged. Separately, `test_256_judge_usage_counted` requires a disposition for every `forced_emit` call site, and `services/describe_files.py` is a new one.
- **Fix:** the pin was re-derived to `:1572`, with the reason written beside the earlier ones. `describe_files.py` was classified `NO-RUN`: the proposal runs from the stateless read door before any `runs` or `workflow_runs` row exists, and the file has no `run_usage_box`, which the sibling test drives.
- **Files modified:** backend/tests/unit/test_256_finish_run_unchanged.py, backend/tests/unit/test_256_judge_usage_counted.py
- **Commit:** 5c625ad27

## Known Stubs

None. Every arm is wired to real reads. The proposal returns `[]` on failure by design: a flat PDF then reads as "none", which is honest.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: egress | backend/app/services/describe_files.py | Read-time `forced_emit` sends attached-file text (fenced, untrusted) to the authoring model, and scans send rendered pages to the vision model. Both are covered by T-291-02 and T-291-07; listed so the review sees the new call site |

## Notes for the orchestrator

- The `docs/HOT-FILE-LEDGER.md` rows for `workflow_authoring_doors.py`, `workflow_wire.py` and `workflows.py`, and the CLAUDE.md FIRING row for `workflows.py`, were not re-derived here. This plan added their content, so their triples are now stale until the phase-close ledger pass.
- D-03's "up to 5 references" is not counted server-side by the reference door, which stores one file per call. The count belongs to the describe door's client and to 291-02's generate body cap.
- `graphify update .` was not run inside the worktree.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (step 0) | 5e1076e15 | docs(291-01): ledger rows for the files phase 291 touches |
| 1 RED | 3d6b99963 | test(291-01): failing reader tests |
| 1 GREEN | 5a8e0ef1b | feat(291-01): describe_files reader leaf |
| 2 RED | 4b8213c37 | test(291-01): failing Word fillable-copy tests |
| 2 GREEN | c57a9e537 | feat(291-01): Word fillable copy with exactly-once check |
| 3 RED | 850427a84 | test(291-01): failing door tests |
| 3 GREEN | e79480384 | feat(291-01): describe read door, pdf/Word-copy/reference binds |
| wave gate | 5c625ad27 | test(291-01): re-derive two 256 fences the full gate reddened |

## Self-Check: PASSED

- All four created files are present: `describe_files.py`, `test_291_describe_read.py`, `test_291_word_copy.py` and `test_291_describe_read_door.py`.
- All eight commits above are present in `git log`.
- The plan's six verify suites pass.
- The ledger gate exits 0 and the extension-contract gate is OK.
- The full backend gate reads 70 failed, the same set as base.
