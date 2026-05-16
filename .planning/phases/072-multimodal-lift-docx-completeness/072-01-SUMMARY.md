---
phase: 072-multimodal-lift-docx-completeness
plan: 01
subsystem: backend-extraction
tags: [phase-072, multimodal, app-settings, vision-api, downscale, ragmm, d-072-02, d-072-03, d-072-08]

# Dependency graph
requires:
  - phase: 071 (PdfExtractor Abstraction Scaffold)
    provides: migration 044 (multimodal_max_vision_calls / multimodal_max_b64_bytes_kb columns); UserEffectiveSettings.multimodal_max_* fields at backend/app/models/user_settings.py:91-92
  - phase: 071.2 (Ingestion Plumbing + Per-Aspect Dispatcher)
    provides: extract_and_store_images signature with app_settings + extracted_doc kwargs already plumbed; D-071.2-08 bbox flow contract; multimodal_service.py is the single PDF/DOCX image-extraction call site
  - phase: 071.4 (Polish Bundle)
    provides: in-process PyMuPDF (AGPL subprocess fence retired); /reingest delete cascade (binding tests can rely on a clean slate)
provides:
  - Module-scope `MULTIMODAL_THUMBNAIL_MAX_EDGE = 1024` constant + shared `_downscale_b64_for_vision(b64_png, max_edge=...)` helper at `backend/app/services/multimodal_service.py` — Plan 03's retry path will import this same helper so both call sites honor the D-072-02 invariant from a single source (WARNING 3)
  - extract_and_store_images now reads cap (`app_settings.multimodal_max_vision_calls`) + b64 size (`app_settings.multimodal_max_b64_bytes_kb * 1024`) from app_settings instead of deleted module constants (`_MAX_VISION_CALLS`, `_MAX_B64_BYTES`)
  - Persist-empty-description contract: image rows persist with `description=''` when describe_image returns empty or raises (D-072-03) — eligible for cheap /reextract refill (Plan 03)
  - Chunk-embedding loop's `if not desc: continue` filter preserved byte-identical (D-01/D-02/D-03 invariant from Phase 36 — no vector-index regression)
affects:
  - Phase 072 Plan 02 (DOCX dedup) — can rely on the persist-empty-row contract being live
  - Phase 072 Plan 03 (lazy retry + UAT) — will `from backend.app.services.multimodal_service import _downscale_b64_for_vision` and call it in `_reextract_refill_empty_descriptions` so both call sites share the D-072-02 invariant
  - SEED-021 (image-axis recall lift) — Plan 01 closes the storage cap; SEED-021's future OSS spike (Marker / PDFFigures2 / pdfplumber.figures) re-opens after measurement
  - v3.1 admin shell — MULTIMODAL_THUMBNAIL_MAX_EDGE is a hardcoded constant for v2.6; a third app_setting for the downscale dimension is deferred to v3.1 (D-072-02 note)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared helper at module scope for single-source invariant — `_downscale_b64_for_vision` exposed at the same level as the constants it depends on; lazy `from PIL import Image as PILImage` keeps Pillow import cost out of module load"
    - "app_settings read-through pattern — production code reads `app_settings.foo` directly rather than module-level constants; tests must explicitly set the attribute on `MagicMock()` instances (auto-magic Mock attribute access creates un-comparable objects)"
    - "Persist-empty-row contract — pre-072 dropped vision-failure rows; post-072 persists with `description=''` so a future /reextract can refill cheaply, while the chunk-embedding pass still skips empties (preserves vector-index quality)"

key-files:
  created: []
  modified:
    - "backend/app/services/multimodal_service.py — module constants `_MAX_VISION_CALLS=20` + `_MAX_B64_BYTES=512*1024` deleted; new constant `MULTIMODAL_THUMBNAIL_MAX_EDGE=1024` + shared helper `_downscale_b64_for_vision` added at module scope (lines 29-81); `extract_and_store_images` swapped to read `app_settings.multimodal_max_vision_calls` (line 375) + `app_settings.multimodal_max_b64_bytes_kb * 1024` (line 380); shared helper invoked before every `describe_image` (line 388); empty-description early-continue removed; chunk-embedding filter preserved byte-identical"
    - "backend/tests/unit/test_multimodal_extraction.py — 3 new tests + 1 contract inversion + 2 pre-existing tests adjusted for the new app_settings read pattern"

key-decisions:
  - "Shared `_downscale_b64_for_vision` helper at module scope (NOT inlined in extract_and_store_images) — WARNING 3 invariant: Plan 03 will import the SAME helper from the retry path; co-locating the downscale logic in one source prevents the regression where one call site silently bypasses it (D-072-02)"
  - "PIL decode failure in `_downscale_b64_for_vision` degrades to returning input b64 unchanged (broad-except + log.debug, never raises) — D-069-04 silent-swallow invariant; vision-LLM gets a chance even on borderline-corrupt thumbnails"
  - "Persist-empty-description contract inverts the pre-072 `test_image_description_failure_continues` test — the test's docstring + assertion were updated in-task to reflect the new D-072-03 surface; this is a deliberate breaking change to the test contract, not a regression"
  - "Stale docstring reference `Capped at _MAX_VISION_CALLS per document.` updated to `Capped at app_settings.multimodal_max_vision_calls per document (D-072-08)` — required to pass the grep gate `assert src.count('_MAX_VISION_CALLS') == 0`"

patterns-established:
  - "WARNING-3 single-source invariant — when two call sites need to enforce the same contract (here: PIL.thumbnail 1024px downscale before vision-LLM call), extract the contract into a shared module-scope helper so both call sites import + invoke the same function. Avoids the regression where one site silently drifts."
  - "app_settings mock attribute pattern for tests — `MagicMock()` auto-magic attribute access creates un-comparable Mock objects that break arithmetic comparisons like `len(b64) > app_settings.foo * 1024`. Tests against production code that reads `app_settings.foo` MUST set the attribute explicitly (e.g. `mock_settings.foo = 4096`). Documented in 2 pre-existing tests fixed in this plan."

requirements-completed: [RAG-MM-LIFT-01]

# Metrics
duration: ~12min
completed: 2026-05-16
---

# Phase 072 Plan 01: Multimodal Lift — App-Settings Reads + Shared Downscale Helper Summary

**`multimodal_service.extract_and_store_images` now reads `app_settings.multimodal_max_vision_calls` / `multimodal_max_b64_bytes_kb` (closing the migration-044 → consumer dead-code gap), invokes a shared `_downscale_b64_for_vision` helper before every vision-LLM call so Plan 03's retry path can share the D-072-02 invariant from one source, and persists `description=''` rows instead of dropping them so lazy /reextract can cheaply refill empties.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-16T19:35Z (worktree branch base reset)
- **Completed:** 2026-05-16T19:47Z
- **Tasks:** 2 (both `type="auto" tdd="true"`)
- **Files modified:** 2 (1 production, 1 test)
- **LOC delta:** production +49 / −13 net; test +200 / −4

## Accomplishments

- **Module constants `_MAX_VISION_CALLS=20` and `_MAX_B64_BYTES=512*1024` deleted** — both consumers in `extract_and_store_images` swapped to `app_settings.multimodal_max_vision_calls` and `app_settings.multimodal_max_b64_bytes_kb * 1024`. Closes the dead-code state between migration 044 + `UserEffectiveSettings.multimodal_max_*` (Phase 071) and `multimodal_service.py` (which had been ignoring them).
- **New `MULTIMODAL_THUMBNAIL_MAX_EDGE = 1024` constant + shared `_downscale_b64_for_vision(b64_png, max_edge=...)` helper at module scope** — WARNING 3 single-source invariant. `extract_and_store_images` invokes the helper before every `describe_image` call. Plan 03's `_reextract_refill_empty_descriptions` will import the SAME helper from the retry path, so both call sites honor D-072-02 from one source.
- **Empty-description rows persist** (D-072-03) — pre-072 code's `if not description: log.debug(...); continue` was removed; now the `rows.append({...})` runs unconditionally and `description=""` rows reach the `document_images` INSERT. A future /reextract (Plan 03) can refill cheaply.
- **Chunk-embedding filter preserved byte-identical** — the loop at lines 432-435 still skips rows whose `description` is empty/stripped-empty before building the embedding payload. Phase 36's D-01/D-02/D-03 vector-index-quality invariant is intact (no empty-string embeddings).
- **3 new unit tests + 1 contract inversion + 2 pre-existing mock-fixup tests** — full multimodal pytest file green (13/13). Sibling regression spot-check green (`test_extract_composable.py` + `test_aspect_engines_text.py` — 19/19 across the trio).

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace module constants + add shared helper + delete empty-desc early-continue** — `a164002` (feat)
2. **Task 2: Add 3 tests + invert empty-desc test contract + Rule-1 fix to 2 pre-existing tests** — `a90d877` (test)

_Note: Plan 01 was scoped TDD=true on both tasks, but the plan-author's task ordering put production code in Task 1 and tests in Task 2. Followed plan-author ordering — Task 1 commit is `feat`, Task 2 commit is `test`. No RED→GREEN→REFACTOR ceremony was added on top._

## Files Created/Modified

- `backend/app/services/multimodal_service.py` — module-level constants + shared downscale helper + app_settings reads + empty-row persistence; chunk-embedding loop untouched (D-01/D-02/D-03 invariant preserved)
- `backend/tests/unit/test_multimodal_extraction.py` — 3 new Phase 072 tests (`test_app_settings_max_vision_calls_read`, `test_downscale_before_vision_call`, `test_persist_empty_description_row`); inverted contract on `test_image_description_failure_continues`; Rule-1 fix on `test_pdf_images_stored` + `test_extract_and_store_images_uses_extracted_doc` (explicit `multimodal_max_*` attrs on mock_settings)

## Decisions Made

All listed in frontmatter `key-decisions`. Highlights:

- Shared helper at module scope (NOT inlined) — single-source invariant for Plan 03 retry path.
- PIL decode failure in helper degrades to return input b64 unchanged (D-069-04 silent-swallow).
- Persist-empty-row contract deliberately inverts the pre-072 `test_image_description_failure_continues` assertion.
- Stale docstring `Capped at _MAX_VISION_CALLS per document.` updated to satisfy the grep gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing test `test_pdf_images_stored` broke after Task 1 production change**
- **Found during:** Task 2 verification (full `pytest tests/unit/test_multimodal_extraction.py -q` after writing the 3 new tests)
- **Issue:** `test_pdf_images_stored` (line 104) and `test_extract_and_store_images_uses_extracted_doc` (line 495) use `mock_settings = MagicMock()` without setting `multimodal_max_vision_calls` / `multimodal_max_b64_bytes_kb`. After Task 1 changed production code from `len(b64) > _MAX_B64_BYTES` (compile-time constant) to `len(b64) > app_settings.multimodal_max_b64_bytes_kb * 1024` (attribute access), the comparison becomes `int > MagicMock() * 1024 = int > <MagicMock>`, which raises `TypeError: '>' not supported between instances of 'int' and 'MagicMock'`. The outer try/except swallows it as "Image extraction failed", and the document_images INSERT never runs — test fails with `table('document_images') call not found`.
- **Fix:** Added two lines `mock_settings.multimodal_max_vision_calls = 100` + `mock_settings.multimodal_max_b64_bytes_kb = 4096` to each affected test's mock_settings setup. Comment block documents that production code now reads these from app_settings.
- **Files modified:** `backend/tests/unit/test_multimodal_extraction.py` (lines around 117 and 513)
- **Verification:** Full `pytest tests/unit/test_multimodal_extraction.py -q` → 13 passed; sibling spot-check `pytest tests/unit/test_multimodal_extraction.py tests/unit/test_extract_composable.py tests/unit/test_aspect_engines_text.py -q` → 19 passed.
- **Committed in:** `a90d877` (Task 2 commit — fold of new tests + contract inversion + Rule 1 fix)
- **Scope:** Directly caused by Task 1's production change. Within scope per deviation rules.

**2. [Rule 2 - Missing critical] Stale docstring reference `Capped at _MAX_VISION_CALLS per document.`**
- **Found during:** Task 1 verification (the plan's grep gate `assert src.count('_MAX_VISION_CALLS') == 0`)
- **Issue:** Production code deleted the constant but the docstring at `extract_and_store_images` (line 337) still mentioned `Capped at _MAX_VISION_CALLS per document.` — would have failed the grep gate.
- **Fix:** Updated docstring to `Capped at \`app_settings.multimodal_max_vision_calls\` per document (D-072-08).` Plus updated the "Vision API failures store empty description rather than skipping the row." line to add the D-072-03 cross-reference.
- **Files modified:** `backend/app/services/multimodal_service.py`
- **Verification:** Grep gate passes; pytest green.
- **Committed in:** `a164002` (Task 1 commit — folded into same surgical edit)
- **Scope:** Required to satisfy the plan's acceptance criteria. Within scope.

**3. [Pre-execution] Worktree branch wrong base + initial edits leaked into main repo**
- **Found during:** Pre-Task-1 worktree branch base check
- **Issue:** `git merge-base HEAD <expected>` returned an OLDER commit (`9ee96ad`) than the orchestrator-supplied base (`30e125e`). Per the worktree_branch_check directive, hard-reset to the expected base. Subsequently, my first Edit tool call against `multimodal_service.py` resolved the absolute path to the MAIN repo, not the worktree (Edit tool absolute paths bypass cwd). Reverted the main-repo file with `git checkout -- backend/app/services/multimodal_service.py` (single file, surgical) before any commit; re-applied the same edits with explicit worktree paths.
- **Fix:** Hard-reset worktree to correct base; reverted unintended main-repo edit; re-applied edits with the worktree-prefixed absolute path; copied `backend/.env` into the worktree (it's gitignored, required for Python `Settings()` import during the import-check gate).
- **Files modified:** None permanently in main repo; worktree files modified as planned.
- **Verification:** `git status` clean on main repo for `multimodal_service.py`; worktree file has the planned edits; `.env` is gitignored (not in `git status --short`).
- **Committed in:** N/A (pre-task hygiene, not a code change)
- **Scope:** Tool-orchestration hygiene, no production impact.

---

**Total deviations:** 3 (1 Rule-1 bug, 1 Rule-2 critical-doc, 1 pre-execution hygiene)
**Impact on plan:** Plan-shape unchanged. All deviations within the file already in scope. No new files created. No architectural changes.

## Issues Encountered

- The plan refers to the pre-072 vision-failure test as `test_image_vision_failure_continues`, but the actual file uses `test_image_description_failure_continues`. Same test, different name. Updated the actual existing test; documented in the Task 2 commit.

## Verification Evidence

| Gate | Expected | Actual | Pass |
|------|----------|--------|------|
| `_MAX_VISION_CALLS\|_MAX_B64_BYTES` deleted | grep `-c` == 0 | 0 | ✓ |
| `MULTIMODAL_THUMBNAIL_MAX_EDGE = 1024` at module scope | grep `^…=1024$` == 1 | 1 | ✓ |
| `def _downscale_b64_for_vision` | grep `-c` == 1 | 1 | ✓ |
| `_downscale_b64_for_vision` occurrences total | >= 2 | 3 (def + call site + docstring) | ✓ |
| `app_settings.multimodal_max_vision_calls` | >= 1 | 2 (use + docstring) | ✓ |
| `app_settings.multimodal_max_b64_bytes_kb * 1024` | >= 1 | 1 | ✓ |
| `Skipping image with no description` deleted | grep `-c` == 0 | 0 | ✓ |
| `if not desc:` chunk-embedding preserved | grep `-c` >= 1 | 1 | ✓ |
| Module imports cleanly | `python -c "from app.services.multimodal_service import _downscale_b64_for_vision, MULTIMODAL_THUMBNAIL_MAX_EDGE"` | OK | ✓ |
| 3 new test functions defined | grep `-c def test_…` == 1 each | 1, 1, 1 | ✓ |
| `test_image_description_failure_continues` no longer `insert.assert_not_called()` | grep `-c` == 0 | 0 | ✓ |
| Full multimodal pytest | 13 passed | 13 passed | ✓ |
| Sibling regression (multimodal + extract_composable + aspect_engines_text) | 19 passed | 19 passed | ✓ |

## User Setup Required

None — no migrations applied in this plan (migration 044 already shipped in Phase 071). Plan 01 is pure backend code + tests. No env-var or dashboard work.

## Next Phase Readiness

**Plan 02 (DOCX dedup):** ready. Persist-empty-row contract is live; Plan 02 can safely add the `related_parts` walk + content-hash dedup without worrying about the empty-row drop case.

**Plan 03 (lazy retry + UAT):** ready. Plan 03 will:
1. `from app.services.multimodal_service import _downscale_b64_for_vision` in the new `_reextract_refill_empty_descriptions` retry path.
2. Invoke `_downscale_b64_for_vision(b64)` before its own `describe_image` call.
3. Refill `document_images.description` rows where `description = ''` (the Plan 01 persist-empty-row contract makes these rows discoverable).

Both call sites share the D-072-02 invariant from one source (WARNING 3 closed).

**Known stubs:** None.

**Threat flags:** None new. Plan 01 stays inside the `storage→vision-LLM` and `user→app_settings` trust boundaries already documented in PLAN.md's `<threat_model>` (T-072-01-01 / T-072-01-02 / T-072-01-03 dispositions unchanged).

## Self-Check: PASSED

- File `backend/app/services/multimodal_service.py` exists: ✓ (modified)
- File `backend/tests/unit/test_multimodal_extraction.py` exists: ✓ (modified)
- Commit `a164002` in `git log`: ✓
- Commit `a90d877` in `git log`: ✓

---
*Phase: 072-multimodal-lift-docx-completeness*
*Plan: 01*
*Completed: 2026-05-16*
