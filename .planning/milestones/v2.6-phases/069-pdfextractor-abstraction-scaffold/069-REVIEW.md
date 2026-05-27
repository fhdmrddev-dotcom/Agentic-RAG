---
phase: 069
reviewed: 2026-05-13T00:00:00Z
fixed: 2026-05-14T00:00:00Z
status: issues
findings:
  blocking: 0
  high: 0
  medium: 2
  low: 3
fixes_applied:
  - "BLOCKER — ExtractedDocument.tables/images switched to tuple[T, ...] (commit f305145)"
  - "HIGH — Pillow>=10.0.0 declared in requirements.txt (commit 88a3113)"
  - "HIGH — error-field tests migrated to patch.object on LegacyExtractor methods (commit f305145, bundled with BLOCKER fix)"
deferred_to_phase_071:
  - "MEDIUM — TODO(Phase 071) at documents.py discard site"
  - "MEDIUM — golden-capture os.environ.setdefault prod-creds bleed (document clean-shell requirement)"
  - "LOW — _LEGACY singleton Phase 071 stateful-engine hint"
  - "LOW — _generate_fixtures.py missing `from __future__ import annotations`"
  - "LOW — empty-PDF test builds real pypdf rather than stubbing"
---

# Phase 069: Code Review — PdfExtractor Abstraction Scaffold

**Reviewed:** 2026-05-13
**Depth:** deep (cross-file analysis)
**Files Reviewed:** extraction_service.py, documents.py (targeted edits), test_extraction_service.py, fixtures/extraction/_generate_fixtures.py

---

## Findings

| # | Severity | File : Line | Issue | Suggested Fix |
|---|----------|-------------|-------|---------------|
| 1 | BLOCKER  | `extraction_service.py:57–60` | `frozen=True` dataclasses hold mutable `list` fields — callers can silently mutate `TableData.rows`, `TableData.headers`, `ImageData` content, `ExtractedDocument.tables`, and `ExtractedDocument.images` through the returned references. `frozen=True` prevents field reassignment but does nothing to prevent in-place mutation of the lists. Any future engine (Phase 071) or test code that mutates the returned `ExtractedDocument` will corrupt the object with no error. | Replace bare `list[str]` / `list[list[str]]` / `list[TableData]` / `list[ImageData]` fields with `tuple` types, or use `field(default_factory=...)` with a custom `__post_init__` that converts the input lists to tuples. At minimum, document the mutability gap prominently in the class docstring so Phase 071 authors don't assume immutability. |
| 2 | HIGH     | `test_extraction_service.py:94–95` | Patch target `"app.services.multimodal_service.extract_pdf_tables"` patches the function in the module's namespace, which works **only** if `multimodal_service` is already in `sys.modules` when the `with patch(...)` context is entered. Because `_extract_tables` does a lazy `from app.services.multimodal_service import extract_pdf_tables` inside the method body, Python resolves this to `sys.modules["app.services.multimodal_service"].extract_pdf_tables` at call time — which is the patched attribute, so the tests pass in isolation. However, if `multimodal_service` is NOT yet imported (e.g., a fresh process, test-ordering change, or future `importlib.reload`) the patch will import the real module first and then patch it, which is the correct behavior — **but** the behaviour is load-order dependent and fragile. The analogous image test at line 109 has the same issue. | Patch at the import site instead: `patch("app.services.extraction_service.LegacyExtractor._extract_tables", ...)` directly, or use `patch.object(LegacyExtractor, "_extract_tables", side_effect=RuntimeError(...))` to be completely load-order independent and not reach through a module boundary. |
| 3 | HIGH     | `requirements.txt` (missing entry) | `Pillow` (`PIL`) is imported directly in `_generate_fixtures.py` (line 4: `from PIL import Image as PILImage`) and transitively required by `multimodal_service.py` (lines 139, 182). It is not declared in `requirements.txt`. The package currently arrives as a transitive dep of `pdfplumber` or `sentence-transformers`, but neither of those packages pins Pillow, and a future version bump of either could drop it, silently breaking both production image extraction and fixture generation. Because `multimodal_service.py` is production code (not dev-only), `Pillow` must be an explicit first-party dependency. | Add `Pillow>=10.0.0` (or the currently-installed version) to `backend/requirements.txt`. |
| 4 | MEDIUM   | `documents.py:229–239` (upload path) and `documents.py:460–467` (re-ingest path) | `extractor.extract(raw, mime_type).text` discards `ExtractedDocument.tables` and `.images` entirely. `ingest_document` then re-extracts tables and images from `raw` via `extract_and_store_*` — performing two full pdfplumber passes per upload. The PLAN explicitly accepts this ("duplicate extraction acceptable for Phase 069") but there is no runtime guard preventing this double work from cascading into production workloads before Phase 071 ships the tightening. A user uploading a large PDF with many tables will pay the pdfplumber cost twice in the same request lifecycle, once eagerly on the upload thread (inside `extractor.extract`) and once in the background task. | Accepted for Phase 069 per design decision; however, add an inline comment at the discard point making the technical debt explicit with a Phase 071 FIXME so it is not silently carried forward: `# TODO(Phase 071): pass extracted.tables/images into ingest_document to eliminate double-extraction`. Currently the only reference is in PATTERNS.md/SUMMARY.md which are not code-adjacent. |
| 5 | MEDIUM   | `_generate_fixtures.py:175–179` | The env-var bootstrap in `write_golden_jsons()` uses `os.environ.setdefault(...)`, which is harmless if the env is clean — but if the developer's shell already has a production `SUPABASE_URL` set, the golden capture will run against production settings (real Supabase, real LLM keys) rather than the test stubs. A misconfigured developer machine would capture a golden JSON that only works with production credentials, breaking CI. `setdefault` is the right choice for CI but the wrong choice for interactive developer use. | Add a guard or warning: before the `setdefault` calls, check if `SUPABASE_URL` is already set to something that does NOT match the test stub domain, and print a warning. Alternatively, document explicitly in the script's top-level docstring that the generator must be run in a clean shell (or with `env --ignore-environment`) to avoid credential bleed. |
| 6 | LOW      | `extraction_service.py:172` | `_LEGACY = LegacyExtractor()` is a module-level singleton. The docstring says "stateless — safe to share", which is true today since `LegacyExtractor` has no instance state. However, Phase 071 will add `DoclingExtractor` and `PyMuPDFExtractor` behind the same `get_extractor` dispatcher, and those engines may carry configuration state (model paths, engine options read from `app_settings`). The singleton pattern will force Phase 071 authors to choose between making all future engines stateless (potentially expensive per-call re-init) or refactoring the singleton — with no hint in the code that state is coming. | Add a comment to `_LEGACY` and `get_extractor`: `# Phase 071: if DoclingExtractor/PyMuPDFExtractor carry config state, this singleton will need to become a factory or a config-keyed cache.` |
| 7 | LOW      | `test_extraction_service.py:122–142` | `test_legacy_extractor_empty_pdf_returns_empty_extracted_document` builds a blank PDF via `PdfWriter`, which is a real call to `pypdf`. This makes the test dependent on `pypdf` being installed and the `PdfWriter.write` API remaining stable. The test is labeled a Layer 3 (error-field semantics) test but it exercises the real extraction pipeline rather than using mocks/stubs. If `pypdf` introduces a breaking change in `PdfWriter.write` in a future release, this test will fail for reasons unrelated to the error-field semantics it is testing. | Either stub `_extract_text` to return `""` (as the other Layer 3 tests do) and test the contract directly, or move this test to a separate "integration" layer with an explicit comment explaining why it uses real `pypdf`. |
| 8 | LOW      | `_generate_fixtures.py` (no `__from __future__ import annotations`)| Every other new module in this phase uses `from __future__ import annotations` at the top (consistent with the codebase-wide pattern documented in PATTERNS.md). The generator script does not. This is a minor consistency gap; it is a one-time script so it will not cause runtime problems on Python 3.10+, but it deviates from the established project convention. | Add `from __future__ import annotations` as the first line after the module docstring. |

---

## Notes on Known / Accepted Issues

The following were found and explicitly accepted in the SUMMARY.md and PLAN.md — they are noted here for completeness but are NOT counted in the finding totals above:

- **Double-extraction in `ingest_document`** — finding #4 above flags the missing code-level TODO; the design decision itself is accepted.
- **DOCX inline-image extraction broken under python-docx 1.2** (`shape._inline.graphic.graphicData.pic.blipFill.blip.part.blob` raises `AttributeError` silently) — pre-existing latent bug, documented in `deferred-items.md`, out of Phase 069 scope.
- **pdfplumber + PIL fail to decode ReportLab-embedded PDF image streams** — pre-existing latent bug, documented in `deferred-items.md`.
- **Two pre-existing integration test failures** (`test_ingest_stores_full_markdown`, `test_upload_with_valid_folder_id_returns_201`) — confirmed not introduced by Phase 069, documented in SUMMARY.md.
- **Golden fixtures encode `images: []` despite embedded PNG** — this is the correct canonical baseline for the latent pdfplumber/PIL bug above; the golden gate is doing its job by pinning the current (imperfect) behavior.

---

## Recommendation

**Do not block on the BLOCKER finding before merging** if Phase 071 is the intended stabilization point — but the `frozen=True` + mutable list gap should be resolved before Phase 071 authors write any engine that returns `ExtractedDocument`, as it will create a silent correctness trap. The two HIGH findings are test-reliability issues that could cause flaky failures after a test-ordering change; they should be addressed in this phase or as the first action of Phase 071.

Priority order:
1. **BLOCKER #1** — fix before Phase 071 adds new engines (any engine implementor will assume `frozen=True` means truly immutable)
2. **HIGH #3** — add `Pillow` to `requirements.txt` now (trivial one-line fix, risk of silent production breakage is real)
3. **HIGH #2** — harden patch targets in tests (low effort, prevents order-dependent test flakiness)
4. **MEDIUM #4** — add inline FIXME comment (documentation only, one line)
5. **MEDIUM #5** — harden golden-capture script (add warning comment, low effort)
6. **LOW #6, #7, #8** — cleanup / documentation, can ride with Phase 071

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
