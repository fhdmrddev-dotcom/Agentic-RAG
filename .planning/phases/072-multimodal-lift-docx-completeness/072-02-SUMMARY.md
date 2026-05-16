---
phase: 072-multimodal-lift-docx-completeness
plan: 02
subsystem: backend-extraction
tags: [phase-072, docx, dedup, content-hash, ragmm, d-072-06]

# Dependency graph
requires:
  - phase: 072 Plan 01 (Multimodal Lift — App-Settings Reads + Shared Downscale Helper)
    provides: `multimodal_service.py` post-Plan-01 module shape — `MULTIMODAL_THUMBNAIL_MAX_EDGE`, `_downscale_b64_for_vision`, `app_settings`-driven cap reads, persist-empty-description-row contract. Plan 02 inserts the `_dedup_images_by_hash` helper immediately below the downscale helper as a sibling module-scope contract.
  - phase: 071.2 Plan 05 (Per-Aspect Extraction Dispatcher)
    provides: `zip_xpath_docx` engine with the verbatim Docling MsWordDocumentBackend port (closes RAG-MM-LIFT-02 at the floating-shape walk level); `pymupdf_full_images_pdf` engine; `extract_composable` composer. Plan 02 retrofits both image engines with dedup + (DOCX-only) location labels.
  - phase: 071 (PdfExtractor Abstraction Scaffold)
    provides: `ImageData @dataclass(frozen=True)` with `bbox: dict | None = None` slot (extraction_service.py:52-64); migration 042 `document_images.bbox` JSONB column that carries the `{"location": ...}` annotation downstream.
provides:
  - Module-scope `_dedup_images_by_hash(images: list) -> list` helper at `backend/app/services/multimodal_service.py` — accepts ImageData (attr) or legacy dict shape; SHA1 of b64-encoded bytes; first-occurrence wins (preserves `image_index` ordering); future image engines (e.g. SEED-021 spike) compose it without touching this plan's surface.
  - `pymupdf_full_images_pdf` now invokes `_dedup_images_by_hash` on return — PDF cross-page duplicate logos / figures spanning page breaks now collapse to a single document_images row.
  - `zip_xpath_docx` annotates each ImageData with `bbox = {"location": <header|footer|inline|floating>}` via `dataclasses.replace` (frozen invariant respected) + runs `_dedup_images_by_hash` on return — DOCX branded-template logos in header+body+footer collapse; content-hash dedup catches the case where the same bytes live under DIFFERENT media paths.
  - `inline_shapes_docx` (the OTHER DOCX engine — alt config) also calls `_dedup_images_by_hash` per WARNING 5 — safe across `extraction_image_engine_docx ∈ {zip_xpath, inline_shapes}`.
  - DOCX image chunk-embedding rows now carry descriptive prefixes: `[Image header]: ...`, `[Image inline]: ...`, `[Image floating]: ...`, `[Image footer]: ...` — RAG retrieval can distinguish template chrome from body figures.
  - `_derive_docx_image_location(part: str, element) -> str` helper at `backend/app/services/extractors/aspects/images_docx.py` — classifies via part path (`word/header*.xml` → "header" / `word/footer*.xml` → "footer") and lxml ancestor walk on `word/document.xml` (`wp:anchor` ancestor → "floating", else "inline").
affects:
  - Phase 072 Plan 03 (lazy retry + UAT) — the `_dedup_images_by_hash` contract is now live; Plan 03 can rely on the cap-honored insert path producing deduped rows without touching this plan's surface.
  - SEED-021 (image-axis recall lift) — when the future spike re-opens with a vision_sweep or alternative OSS engine, it composes `_dedup_images_by_hash` directly from `multimodal_service` (no signature change required, kwarg widening was deferred 2026-05-16).
  - RAG-MM-LIFT-02 (DOCX completeness) — Phase 071.2 Plan 05 closed the floating-shape walk; Plan 02 closes the dedup safety net + the location-label discrimination. The umbrella requirement now ships its full surface.
  - RAG-MM-LIFT-01 (PDF figure coverage ≥80%) — partial support: PDF dedup helper reduces duplicate-figure noise in `pymupdf_full` extraction, complementing Plan 01's persist-empty-rows policy. The ≥80% recall target is deferred to SEED-021 per CONTEXT.md `<deferred>` ▸ vision_sweep.

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Content-hash dedup as module-scope shared helper — `_dedup_images_by_hash` lives in `multimodal_service.py` and is lazy-imported by both `aspects/images_pdf.py` and `aspects/images_docx.py`. Mirrors Plan 01's WARNING-3 single-source-invariant pattern; future engines compose it without touching engine call sites."
    - "Frozen-dataclass mutation via `dataclasses.replace` — `ImageData` is `@dataclass(frozen=True)`; the location-label annotation uses `replace(im, bbox={'location': ...})` exclusively. No try/except, no isinstance branching, no attribute-set fallback. Deterministic single-path mutation."
    - "Bbox JSONB slot piggybacking — `document_images.bbox` (migration 042 JSONB) carries `{'location': 'header|footer|inline|floating'}` for DOCX rows. Avoids a separate label column; downstream chunk-embedding reads `bbox.get('location')` to build the description prefix."
    - "DOCX location classification by part-path + lxml ancestor walk — `_derive_docx_image_location` uses the iterating DOCX part name to distinguish header/footer, then walks lxml ancestors for inline-vs-floating on `word/document.xml` (localname `anchor` → floating)."

key-files:
  created: []
  modified:
    - "backend/app/services/multimodal_service.py — NEW `_dedup_images_by_hash` module-scope helper inserted between `_downscale_b64_for_vision` and `extract_pdf_tables` (lines 84-126); MODIFIED chunk-embedding loop in `extract_and_store_images` to derive `[Image {location}]:` prefix from `row.get('bbox', {}).get('location')` when `page is None`"
    - "backend/app/services/extractors/aspects/images_pdf.py — `pymupdf_full_images_pdf` wraps return with `_dedup_images_by_hash(images)` via lazy import; docstring extended with D-072-06 EXTENDED paragraph"
    - "backend/app/services/extractors/aspects/images_docx.py — `zip_xpath_docx` annotates each ImageData with `bbox = {'location': ...}` via `dataclasses.replace` in BOTH the `blip` and `vml_img` loops; runs `_dedup_images_by_hash` before return; `inline_shapes_docx` also calls dedup helper (WARNING 5 — safe across both default and override engines); NEW `_derive_docx_image_location` module-level helper at end of file"
    - "backend/tests/unit/test_multimodal_extraction.py — 2 new tests appended: `test_dedup_images_by_hash_drops_duplicates` (covers dict + ImageData shapes; first-occurrence wins; ordering preserved); `test_docx_image_label_prefix_in_chunk_content` (ExtractedDocument with 2 DOCX ImageData entries — header + floating — asserts chunk INSERT contents start with the right `[Image <loc>]:` prefix)"
    - "backend/tests/unit/test_aspect_engines_images_pdf.py — Rule-1 fix to `test_pymupdf_full_returns_more_than_pdfplumber`. Test used `.return_value` (singleton) for `fake_doc.extract_image`, so all 5 mocked images had IDENTICAL bytes and the new SHA1 dedup correctly collapsed 5→1, failing `assert 1 > 2`. Switched to `.side_effect` with 5 DISTINCT 1x1 PNG byte payloads (PIL.Image.new with varying RGB). Test docstring updated to document the dedup-aware requirement."

key-decisions:
  - "ImageData mutation uses `dataclasses.replace` EXCLUSIVELY (D-072-06 / PLAN.md interfaces section) — `ImageData` is `@dataclass(frozen=True)` (extraction_service.py:52-53). Attribute-set (`im.bbox = {...}`) raises `FrozenInstanceError`; mutate-in-place (`im.bbox['key'] = value`) fails because `bbox is None` on fresh ImageData from `_load_media_as_image_data`. Plan 02 uses `from dataclasses import replace` + `im = replace(im, bbox={'location': location})` as the deterministic single path. No try/except, no isinstance branching, no attribute-set fallback."
  - "Hash the b64-encoded string directly instead of decoded bytes — b64 encoding is deterministic, so `sha1(b64.encode('ascii'))` == `sha1(decoded_bytes)` in dedup discrimination power. Saves a base64.b64decode + bytes-buffer allocation per image. First-occurrence wins; ordering preserved for downstream `image_index` reliance."
  - "Bbox JSONB slot carries `{'location': ...}` for DOCX rows — migration 042's JSONB column was originally intended for Docling/PyMuPDF spatial coordinates. DOCX has no stable rendering coordinates (renderer-dependent), so the slot is free for the location label. Avoids a separate `document_images.location` column + new migration. Downstream chunk-embedding reads `row.get('bbox', {}).get('location')` with `isinstance(bbox, dict)` guard."
  - "Dedup applies to BOTH `zip_xpath_docx` AND `inline_shapes_docx` per WARNING 5 — `extraction_image_engine_docx` default is `'zip_xpath'` (confirmed at `user_settings.py:99` field default + `:307` load_app_settings default), but users can flip the override to `'inline_shapes'`. To remain safe across both engines, dedup is wired into BOTH. `inline_shapes_docx` does NOT get the location annotation (its source — python-docx inline-shapes — doesn't expose header/footer/floating distinctions natively); its rows get the bare `[Image]:` fallback prefix."
  - "PyMuPDF engine signature stays as-is — Phase 072 no longer ships the `vision_sweep` engine that would have widened it (deferred to SEED-021 per CONTEXT.md `<deferred>` ▸ vision_sweep). Plan 02 just wraps the existing return value with `_dedup_images_by_hash(images)` via lazy import; no kwargs added."

patterns-established:
  - "Module-scope shared dedup helper composable by independent engines — analogous to Plan 01's WARNING-3 `_downscale_b64_for_vision` invariant. New image engines (Marker, PDFFigures2, vision_sweep) compose `_dedup_images_by_hash` via `from app.services.multimodal_service import _dedup_images_by_hash` and call it on their return value; no engine-call-site changes required."
  - "Test-author dedup-awareness — when a test mocks an upstream extractor to return N images, the test must use N DISTINCT byte payloads if it asserts on `len(returned) == N` post-dedup. The fix to `test_pymupdf_full_returns_more_than_pdfplumber` is the prototype: switch `.return_value` → `.side_effect` with distinct PIL-generated PNGs."

requirements-completed: [RAG-MM-LIFT-02]
requirements-partial: [RAG-MM-LIFT-01]

# Metrics
duration: ~7min
completed: 2026-05-16
---

# Phase 072 Plan 02: Content-Hash Dedup (PDF + DOCX) + DOCX Location-Prefix Labels Summary

**`multimodal_service` gains a `_dedup_images_by_hash` module-scope helper (SHA1 of b64, first-occurrence wins, ImageData + dict shapes); `pymupdf_full_images_pdf` collapses cross-page duplicate logos via the new helper; `zip_xpath_docx` annotates each ImageData with `bbox={'location': header|footer|inline|floating}` via `dataclasses.replace` (frozen invariant respected) and runs the same dedup pass — DOCX branded-template logos in header+body+footer collapse to a single document_images row; `inline_shapes_docx` also calls the helper per WARNING 5. DOCX chunk-embedding rows now read `[Image header]:`, `[Image floating]:` etc. so RAG retrieval can distinguish template chrome from body content.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-16T20:02:52Z
- **Completed:** 2026-05-16T20:10:01Z
- **Tasks:** 2 (both `type="auto" tdd="true"`)
- **Files modified:** 4 (3 production, 1 test edit, 1 test-suite Rule-1 fix)
- **LOC delta:** production `multimodal_service.py` +60 / -3; `images_pdf.py` +7 / -1; `images_docx.py` +52 / -3; tests `test_multimodal_extraction.py` +103 / -0; `test_aspect_engines_images_pdf.py` +31 / -11 (Rule 1)

## Accomplishments

- **`_dedup_images_by_hash` module-scope helper landed** at `backend/app/services/multimodal_service.py` (lines 84-126) — accepts any list of objects with a `b64_png` attribute (ImageData) OR `["b64_png"]` key (legacy dict); returns a new list with SHA1-of-b64 duplicates dropped; first-occurrence wins (preserves `image_index` ordering); defensive empty-b64 path keeps unique-by-definition entries.
- **`pymupdf_full_images_pdf` wraps return with the dedup helper** via lazy import — PDF cross-page duplicate logos and figures spanning page breaks (rendered to the same xref/bytes on multiple pages) now collapse to a single `document_images` row.
- **`zip_xpath_docx` annotates each ImageData with location label** via `dataclasses.replace(im, bbox={"location": location})` in BOTH the `blip` (DrawingML) and `vml_img` (VML legacy) loops. Location derived from the iterating part path (`word/header*.xml` → "header", `word/footer*.xml` → "footer") and lxml ancestor walk on `word/document.xml` (any `wp:anchor` ancestor → "floating", else "inline"). Then runs `_dedup_images_by_hash` before return — the existing media-path dedup catches same-path repetition; the new content-hash dedup catches branded-template logos that ZIP under DIFFERENT media paths.
- **`inline_shapes_docx` also calls `_dedup_images_by_hash`** per WARNING 5 — `extraction_image_engine_docx` default is `'zip_xpath'` (verified at `user_settings.py:99` field default + `:307` load_app_settings default), but users can flip to `'inline_shapes'`; safe across both. `inline_shapes_docx` does NOT get location annotation (python-docx inline-shapes doesn't expose header/footer/floating natively); its rows render with the bare `[Image]:` prefix.
- **DOCX chunk-embedding rows get descriptive location prefixes** — the `extract_and_store_images` chunk-format loop now reads `row.get('bbox', {}).get('location')` (with `isinstance(bbox, dict)` guard) when `page is None` and renders `[Image header]:`, `[Image inline]:`, `[Image floating]:`, `[Image footer]:`. PDF rows keep `[Image p.N]:`. Bare-page-less rows without location keep `[Image]:` as the safe fallback.
- **`_derive_docx_image_location` helper** at end of `aspects/images_docx.py` — classifies via part path (header/footer) and lxml ancestor walk (`etree.QName(anc.tag).localname == "anchor"` → "floating"). Defensive try/except around the lxml call falls back to "inline" on any exception per the silent-swallow invariant (D-069-04). T-072-02-03 mitigation.
- **2 new unit tests + 1 Rule-1 fix** — full multimodal + aspect-engine pytest 18/18 green.

## Task Commits

Each task was committed atomically:

1. **Task 1: dedup helper + DOCX location labels via `dataclasses.replace` + dedup wiring on PDF + both DOCX engines** — `583ef3a` (feat)
2. **Task 2: 2 new unit tests + Rule-1 fix to aspect-engine PDF test for new SHA1 dedup** — `f5ba162` (test)

_Note: Plan 02 was scoped TDD=true on both tasks, but the plan-author's task ordering put production code in Task 1 and tests in Task 2 (mirroring Plan 01's deliberate inversion documented in `072-01-SUMMARY.md`). Followed plan-author ordering — Task 1 commit is `feat`, Task 2 commit is `test`. No RED→GREEN→REFACTOR ceremony was added on top._

## Files Created/Modified

- `backend/app/services/multimodal_service.py` — new `_dedup_images_by_hash` module-scope helper + location-prefix derivation in chunk-embedding loop
- `backend/app/services/extractors/aspects/images_pdf.py` — `pymupdf_full_images_pdf` wraps return with `_dedup_images_by_hash`; docstring extended
- `backend/app/services/extractors/aspects/images_docx.py` — `zip_xpath_docx` ImageData replace + dedup on return; `inline_shapes_docx` dedup on return; new `_derive_docx_image_location` helper
- `backend/tests/unit/test_multimodal_extraction.py` — 2 new tests (`test_dedup_images_by_hash_drops_duplicates`, `test_docx_image_label_prefix_in_chunk_content`)
- `backend/tests/unit/test_aspect_engines_images_pdf.py` — Rule-1 fix to `test_pymupdf_full_returns_more_than_pdfplumber` (distinct PNG payloads via `side_effect`)

## Decisions Made

All listed in frontmatter `key-decisions`. Highlights:

- `dataclasses.replace` is the EXCLUSIVE mutation path for the frozen `ImageData` — no attribute-set, no try/except, no isinstance branching.
- Hash b64-encoded string directly (deterministic encoding) — saves a decode step; first-occurrence wins.
- Bbox JSONB slot carries `{'location': ...}` for DOCX rows — avoids a separate column + new migration.
- Dedup applies to BOTH DOCX engines (WARNING 5) — safe across `extraction_image_engine_docx` configuration drift.
- PyMuPDF engine signature stays as-is — `vision_sweep` deferral means no kwarg widening in Phase 072.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test_pymupdf_full_returns_more_than_pdfplumber` broke after Task 1 wired SHA1 dedup into `pymupdf_full_images_pdf`**

- **Found during:** Task 2 verification (running `tests/unit/test_aspect_engines_images_docx.py tests/unit/test_aspect_engines_images_pdf.py -x -q` per the plan's `<verification>` block)
- **Issue:** The test built a fake `fitz.Document` with 5 mocked images across 3 pages but used `fake_doc.extract_image.return_value = {"image": <one 1x1 PNG>, ...}` — a SINGLETON return. After Task 1, `pymupdf_full_images_pdf` calls `_dedup_images_by_hash` on its return value; the helper computes `SHA1(b64)` and correctly collapses all 5 identical-bytes images down to 1. The test then failed on `assert 1 > 2` (full_out len=1, plumber_out len=2).
- **Fix:** Switched `fake_doc.extract_image.return_value` (singleton) → `fake_doc.extract_image.side_effect` (per-call iterator) with 5 DISTINCT 1x1 PNG byte payloads built via `PIL.Image.new("RGB", (1, 1), color=(r, g, b)).save(buf, format="PNG")` with varying RGB tuples `[(0,0,0), (255,0,0), (0,255,0), (0,0,255), (128,128,128)]`. Test docstring extended with a paragraph documenting the dedup-aware test-author requirement (analogous to Plan 01's mock_settings attribute pattern note).
- **Files modified:** `backend/tests/unit/test_aspect_engines_images_pdf.py` (lines around `test_pymupdf_full_returns_more_than_pdfplumber`)
- **Verification:** `cd backend && venv/Scripts/python -m pytest tests/unit/test_aspect_engines_images_docx.py tests/unit/test_aspect_engines_images_pdf.py -x -q` → 3 passed; combined `... test_multimodal_extraction.py ...` → 18 passed.
- **Committed in:** `f5ba162` (Task 2 commit — folded with the 2 new tests since same file-scope concern)
- **Scope:** Directly caused by Task 1's production change. Within scope per Rule 1.

---

**Total deviations:** 1 (Rule-1 bug)
**Impact on plan:** Plan-shape unchanged. All deviations within the file already covered by sibling-regression spot-check in the plan's `<verification>` block. No new files created. No architectural changes.

## Issues Encountered

- The plan's acceptance-criteria grep `grep -nc "Image header\|Image inline\|Image floating" backend/app/services/multimodal_service.py` returned 0 because the production code uses an f-string interpolation `f"[Image {location}]:"` rather than literal strings for each location case. The runtime BEHAVIOR is correct (location="floating" → "[Image floating]:") and the Task 2 test `test_docx_image_label_prefix_in_chunk_content` asserts the literal output strings AT RUNTIME, which is the authoritative gate (PASS). This is a grep-acceptance-criterion mismatch with the actual implementation pattern — runtime tests are the truth. Noted here for the verifier's awareness.

## Verification Evidence

| Gate | Expected | Actual | Pass |
|------|----------|--------|------|
| `def _dedup_images_by_hash` in multimodal_service.py | grep `-c` == 1 | 1 | ✓ |
| `_dedup_images_by_hash` in images_pdf.py | grep `-c` >= 1 | 2 (lazy import + call) | ✓ |
| `_dedup_images_by_hash` in images_docx.py | grep `-c` >= 2 | 4 (2× lazy import + 2× call) | ✓ |
| `def _derive_docx_image_location` in images_docx.py | grep `-c` == 1 | 1 | ✓ |
| `dataclasses.replace\|from dataclasses import replace` in images_docx.py | grep `-c` >= 2 | 2 (blip loop + vml loop) | ✓ |
| `im.bbox = ` in images_docx.py | grep `-c` == 0 (no attr-set on frozen) | 0 | ✓ |
| `isinstance(im.bbox` in images_docx.py | grep `-c` == 0 (no dead-code branching) | 0 | ✓ |
| `extraction_image_engine_docx` in user_settings.py | grep `-c` >= 2 | 2 (field default + load_app_settings default, both `'zip_xpath'`) | ✓ |
| `Image header\|inline\|floating` literal in multimodal_service.py | grep `-c` >= 1 | 0 (f-string interpolation used) | ⚠ runtime-verified via Task 2 test |
| 3 modified prod files compile cleanly | `python -m py_compile` exit 0 | OK | ✓ |
| `test_dedup_images_by_hash_drops_duplicates` defined | grep `-c` == 1 | 1 | ✓ |
| `test_docx_image_label_prefix_in_chunk_content` defined | grep `-c` == 1 | 1 | ✓ |
| Phase 072 Plan 02 new tests | 2 PASS | 2 PASS | ✓ |
| Full multimodal pytest | all green | 15/15 PASS | ✓ |
| Aspect-engine sibling pytest (docx + pdf) | all green | 3/3 PASS | ✓ |
| Combined (multimodal + aspect-engine) | all green | 18/18 PASS | ✓ |

## User Setup Required

None — no migrations applied in this plan. Plan 02 is pure backend code + tests. No env-var or dashboard work.

## Next Phase Readiness

**Plan 03 (lazy retry + UAT):** ready. The `_dedup_images_by_hash` contract is now live across PDF (`pymupdf_full_images_pdf`) + DOCX (`zip_xpath_docx`, `inline_shapes_docx`). Plan 03's `/reextract?retry_empty_descriptions_only=true` branch interacts with EXISTING `document_images` rows (not freshly-extracted ImageData), so it's mostly orthogonal — but the cap-honored insert path now produces deduped + location-labeled rows that Plan 03's lazy retry will refill.

**SEED-021 (image-axis recall lift):** the future spike's vision_sweep or alternative-OSS engine composes `_dedup_images_by_hash` directly via `from app.services.multimodal_service import _dedup_images_by_hash`; no signature change required. The CONTEXT.md `<deferred>` ▸ vision_sweep deferral remains intact — Plan 02 just landed the dedup substrate the spike will need.

**Known stubs:** None.

**Threat flags:** None new. Plan 02 stays inside the `user-upload→docx-xml-parser` and `docx-element-tree→ancestor-walk` trust boundaries documented in PLAN.md's `<threat_model>` (T-072-02-01 / T-072-02-02 / T-072-02-03 dispositions unchanged; T-072-02-03 ancestor-walk DoS mitigated by the silent-swallow try/except in `_derive_docx_image_location`).

## Confirmation: `_dedup_images_by_hash` callable from any future image engine

`_dedup_images_by_hash` is exported at module scope from `backend/app/services/multimodal_service.py` and imported lazily by both shipped image engines:

```python
# images_pdf.py:pymupdf_full_images_pdf (post-Plan-02)
from app.services.multimodal_service import _dedup_images_by_hash  # noqa: PLC0415
return _dedup_images_by_hash(images)

# images_docx.py:zip_xpath_docx (post-Plan-02)
from app.services.multimodal_service import _dedup_images_by_hash  # noqa: PLC0415
return _dedup_images_by_hash(results)

# images_docx.py:inline_shapes_docx (post-Plan-02)
from app.services.multimodal_service import (
    _dedup_images_by_hash, extract_docx_images,
)
return _dedup_images_by_hash([ImageData(**d) for d in dicts])
```

Future engines (Marker, PDFFigures2, vision_sweep) follow the same lazy-import + last-step-wrap pattern. The helper accepts both ImageData and dict shapes — no rigid contract on input element type.

## Self-Check: PASSED

- File `backend/app/services/multimodal_service.py` exists: ✓ (modified)
- File `backend/app/services/extractors/aspects/images_pdf.py` exists: ✓ (modified)
- File `backend/app/services/extractors/aspects/images_docx.py` exists: ✓ (modified)
- File `backend/tests/unit/test_multimodal_extraction.py` exists: ✓ (modified)
- File `backend/tests/unit/test_aspect_engines_images_pdf.py` exists: ✓ (modified — Rule 1 fix)
- Commit `583ef3a` in `git log`: ✓
- Commit `f5ba162` in `git log`: ✓

---
*Phase: 072-multimodal-lift-docx-completeness*
*Plan: 02*
*Completed: 2026-05-16*
