---
phase: 071-docling-primary-path
plan: 03
subsystem: backend-extraction-engines
tags: [pymupdf, agpl-fence, subprocess-isolation, ipc, license-compliance, fitz]

requires:
  - phase: 071-docling-primary-path
    plan: 01
    provides: pdf_extraction_runs telemetry table + documents.extractor column + UserEffectiveSettings multimodal-limit fields
  - phase: 071-docling-primary-path
    plan: 02
    provides: get_extractor _PYMUPDF lazy-import branch with ImportError guard + PdfExtractor ABC + ExtractedDocument extended fields (full_markdown / extractor_name / bbox)
  - phase: 070-docling-httpx-spike
    provides: D-070-14 regression-guardrail comment block in requirements.txt + verified Docling/supabase/httpx coexistence
provides:
  - "backend/extractors/ top-level package (sibling to backend/app/) — D-071-04 structural AGPL fence at the file-tree level"
  - "backend/extractors/pymupdf_isolated.py — the ONLY `import fitz` in the entire codebase; child entrypoint reading raw bytes on stdin, writing ExtractedDocument-shaped JSON on stdout; rc=0 success, rc=2 unhandled exception"
  - "backend/app/services/extractors/pymupdf.py — PyMuPDFExtractor(PdfExtractor) parent wrapper that invokes subprocess child with `cwd=BACKEND_DIR` (T-071-03-05) + `env={'PATH': ...}` (T-071-03-01 env scrubbing); contains NO `import fitz`"
  - "ExtractionError class added to backend/app/services/extraction_service.py — surface for subprocess-timeout / malformed-JSON / non-zero-exit failures"
  - "pymupdf>=1.24 pinned in backend/requirements.txt with a verbatim AGPL fence comment block referencing D-PRD-07 Appendix + the binding test"
  - "PYMUPDF_TIMEOUT_S=60 documented in backend/.env.example"
  - "5-scenario binding test suite at backend/tests/integration/test_pymupdf_fence.py — covers T-071-03-01 (env scrubbing) + T-071-03-02 (child happy path) + T-071-03-03 (timeout fail-loud) + T-071-03-04 (AGPL invariant) + parent-wrapper end-to-end"
  - "AGPL fence invariant lockup — `{'fitz','pymupdf','PyMuPDF'} & sys.modules == empty set` after importing every parent-side extraction module"
affects: [071-04, 072, 076, 077]

tech-stack:
  added: ["pymupdf>=1.24 (AGPL-3.0 — license-fenced via subprocess isolation; allowed only in backend/extractors/pymupdf_isolated.py)"]
  patterns:
    - "Module-level redirect (_redirect_stdout_to_stderr) wrapping noisy library calls — protects stdout JSON IPC contract from third-party `print()` pollution (PyMuPDF 1.27 marketing nudge during find_tables)"
    - "Subprocess IPC with stdin-bytes / stdout-JSON contract — `subprocess.run([sys.executable, '-m', module, ...], input=raw, capture_output=True, timeout=N, cwd=BACKEND_DIR, env={'PATH': ...}, check=False)`"
    - "Env-scrub fence: pass only `{'PATH': ...}` to subprocess.run so a fully-compromised child (RCE) cannot reach Supabase service-role keys"
    - "Reverse-translation helper `_payload_to_extracted_document` reconstructs frozen dataclasses from JSON dict — keeps the parent wrapper independent of the child's serialization format choices"

key-files:
  created:
    - backend/extractors/__init__.py
    - backend/extractors/pymupdf_isolated.py
    - backend/app/services/extractors/pymupdf.py
    - backend/tests/integration/test_pymupdf_fence.py
  modified:
    - backend/app/services/extraction_service.py
    - backend/requirements.txt
    - backend/.env.example

key-decisions:
  - "PyMuPDF 1.27's `page.find_tables()` prints a marketing nudge ('Consider using the pymupdf_layout package…') directly to Python `sys.stdout`. Because the child's stdout IS the IPC channel, ANY pollution corrupts the JSON contract. Mitigation: a per-call `_redirect_stdout_to_stderr()` context-manager swaps `sys.stdout` to `sys.stderr` around `find_tables` calls — the nudge surfaces as a diagnostic instead of breaking JSON parse. (Initial os.dup2 fd-level approach was insufficient because the marketing print goes through Python's TextIOWrapper buffer; the Python-level swap catches it.)"
  - "Parent wrapper restricts `supports()` to PDF only (D-071 discretion). DOCX flows continue through DoclingExtractor or LegacyExtractor — PyMuPDF's DOCX path is rarely better than python-docx, and gating DOCX out keeps the fence's surface minimal."
  - "ExtractionError class located in extraction_service.py (not in the parent wrapper) — it's the public surface for any future Plan 04 `/reextract` caller that needs to distinguish 'extractor failure' from 'silent feature degradation'. Placing it in the ABC module keeps it discoverable alongside PdfExtractor."
  - "Pip pin is `pymupdf>=1.24` (no upper bound). The D-070-14 comment block warns the binding test must be re-run on any pin change — that's the lockdown contract, not an upper bound. PyMuPDF major versions have historically been backward-compatible at the public API level we use (`fitz.Document`, `page.find_tables`, `page.get_images`)."

patterns-established:
  - "Pattern: stdout-IPC sentinel — when a child process uses stdout as a structured-data channel, wrap any third-party library calls that might `print()` in a per-call sys.stdout->sys.stderr redirect. Cheaper than mocking the library's print path; library version changes can introduce new prints any time."
  - "Pattern: env scrub at subprocess boundary — pass `env={'PATH': ...}` (not full `os.environ`) when the child runs untrusted code. Even for trusted children, scrubbing reduces blast radius if any future version-of-the-library has an RCE-class CVE."
  - "Pattern: cwd at module-import-time — `_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent` resolved once at import, reused for every subprocess.run. Avoids per-call cwd resolution bugs (the most common subprocess pitfall on Windows path-prefix changes)."

requirements-completed:
  - RAG-DOCLING-01  # partial — PyMuPDF fence + binding test now in place; final SC ratification belongs to Plan 04's UAT gate

duration: ~45min
completed: 2026-05-14
---

# Phase 071 Plan 03: PyMuPDF AGPL Subprocess Fence Summary

**PyMuPDF (AGPL-3.0) is now license-fenced via a 4-layer subprocess isolation pattern — the only `import fitz` in the codebase lives in a child entrypoint OUTSIDE `backend/app/`, the parent wrapper communicates via stdin-bytes / stdout-JSON, the parent process never imports fitz (test-enforced), and the child runs with a scrubbed env.**

## Performance

- **Duration:** ~45 min (executor: Opus 4.7 1M-context)
- **Tasks:** 4 (all completed; 1 deviation logged — see Deviations)
- **Files created:** 4
- **Files modified:** 3
- **Commits:** 4 atomic + this summary

## Accomplishments

- `backend/extractors/__init__.py` + `backend/extractors/pymupdf_isolated.py` shipped — top-level package sibling to `backend/app/` (D-071-04 structural fence at file-tree level). The child reads raw PDF/DOCX bytes on stdin, writes `ExtractedDocument`-shaped JSON to stdout with keys `text / tables / images / table_extraction_error / image_extraction_error / full_markdown / extractor_name='pymupdf'`. Exit codes: 0 = success, 2 = unhandled exception (with the last stderr line carrying a caller-readable error message).
- `backend/app/services/extractors/pymupdf.py` shipped — `PyMuPDFExtractor(PdfExtractor)` parent wrapper that spawns the child via `subprocess.run([sys.executable, '-m', 'extractors.pymupdf_isolated', '--mime', mime], input=raw, capture_output=True, timeout=PYMUPDF_TIMEOUT_S, cwd=_BACKEND_DIR, env={'PATH': ...}, check=False)`. Reverse-translates the JSON payload back into the frozen `ExtractedDocument` / `TableData` / `ImageData` dataclasses via `_payload_to_extracted_document`. Contains ZERO `import fitz` — verified by the runtime invariant test.
- `ExtractionError` class added to `extraction_service.py` — surfaces subprocess-timeout / malformed-JSON / non-zero-exit failures with descriptive messages. Distinct from per-feature silent-swallow errors (D-069-04 `*_extraction_error` fields).
- `pymupdf>=1.24` pinned in `requirements.txt` with a verbatim AGPL fence comment block referencing D-PRD-07 Appendix + `test_pymupdf_fence.py::test_fitz_not_imported_by_parent`. D-070-14 / D-v2.6-01 lines (supabase==2.29.0 / httpx>=0.28.0,<0.29.0 / docling>=2.93.0,<3.0.0) PRESERVED byte-identical to pre-Plan-03 state (verified via `git diff 97cff11:backend/requirements.txt requirements.txt`).
- `PYMUPDF_TIMEOUT_S=60` documented in `backend/.env.example` inside the existing Phase 071 PDF/DOCX section. Plan 02's `EXTRACTOR_PRIMARY=docling` line preserved.
- `test_pymupdf_fence.py` — 5-test binding suite + companion class (6 tests total) covers all 4 STRIDE rows + parent-wrapper end-to-end. All 6 PASS in 0.90s.
- Phase 070 binding gate (`test_pdf_extractor_docling_compat.py`) stays GREEN — new pymupdf pin did NOT perturb the supabase/httpx/docling resolver. Combined run: `pytest test_pymupdf_fence.py test_pdf_extractor_docling_compat.py` → 7 passed + 1 skipped (Phase 070 supabase smoke skip, expected behavior).

## Task Commits

1. **Task 1: backend/extractors/ package + pymupdf_isolated.py child entrypoint** — `7d80ee4` (feat)
2. **Task 2: PyMuPDFExtractor parent wrapper at backend/app/services/extractors/pymupdf.py + ExtractionError class** — `2295cf0` (feat)
3. **Task 3: pymupdf>=1.24 pin in requirements.txt + PYMUPDF_TIMEOUT_S=60 in .env.example** — `a7e026e` (chore)
4. **Task 4: test_pymupdf_fence.py 4-scenario binding suite + companion AGPL invariant class** — `fd2c4f8` (test)

## AGPL Fence Verification (runtime evidence)

The fence holds — empirical evidence captured at the end of Task 4:

```python
import sys, importlib
importlib.import_module('app.services.extraction_service')
importlib.import_module('app.services.extractors.docling')
importlib.import_module('app.services.extractors.pymupdf')
importlib.import_module('app.api.documents')

# Forbidden present after full parent-side import:
>>> sorted({'fitz', 'pymupdf', 'PyMuPDF'} & set(sys.modules))
[]                                              # ← empty: fence holds

# Standard library deps in sys.modules:
>>> 'subprocess' in sys.modules, 'json' in sys.modules
(True, True)                                    # ← parent has subprocess + json, but NOT fitz

# Resolved _BACKEND_DIR (subprocess cwd):
>>> from app.services.extractors.pymupdf import _BACKEND_DIR
>>> str(_BACKEND_DIR)
'C:\\Vibe Apps\\Agentic RAG\\backend'           # ← matches `cd backend` from project root
```

## Test Results

### Plan 03 binding suite

```
cd backend && venv/Scripts/python -m pytest tests/integration/test_pymupdf_fence.py -x --tb=short -v
```

| Test | Maps to STRIDE row | Status |
|------|----|--------|
| `test_fitz_not_imported_by_parent` (module-level) | T-071-03-04 (AGPL invariant) | PASSED |
| `TestChildEntrypoint::test_pymupdf_child_extracts_reference` | T-071-03-02 (happy path / JSON shape) | PASSED |
| `TestChildEntrypoint::test_pymupdf_child_strips_supabase_env` | T-071-03-01 (env scrubbing) | PASSED |
| `TestChildEntrypoint::test_pymupdf_parent_wrapper_happy_path` | T-071-03-05 (cwd / IPC wiring end-to-end) | PASSED |
| `TestChildEntrypoint::test_pymupdf_child_timeout_raises_extraction_error` | T-071-03-03 (timeout fail-loud) | PASSED |
| `TestParentWrapperAGPLInvariant::test_invariant_holds_after_full_app_import` | T-071-03-04 (companion class) | PASSED |

**6 passed in 0.90s.**

### Combined gate (Plan 03 + Phase 070)

```
cd backend && venv/Scripts/python -m pytest tests/integration/test_pymupdf_fence.py tests/integration/test_pdf_extractor_docling_compat.py -x --tb=short
```

**7 passed, 1 skipped, 2 warnings in 16.74s.** Phase 070 binding gate stays GREEN — new pymupdf pin did not perturb the resolver. Skip is the expected `test_supabase_smoke_post_resolution` which skips when `SUPABASE_URL` is the test default.

## Plan-Level Acceptance Verification

| Criterion | Expected | Actual |
|-----------|----------|--------|
| `backend/extractors/__init__.py` exists | yes | yes ✓ |
| `backend/extractors/pymupdf_isolated.py` exists | yes | yes ✓ |
| `backend/app/services/extractors/pymupdf.py` exists | yes | yes ✓ |
| `backend/tests/integration/test_pymupdf_fence.py` exists | yes | yes ✓ |
| `grep -rnE "^import fitz$|^from fitz" backend/ --exclude-dir=venv` returns ONLY `extractors/pymupdf_isolated.py` | 1 file | 1 file ✓ |
| `grep -c "^import fitz" extractors/pymupdf_isolated.py` | 1 | 1 ✓ |
| `grep -cE "^import fitz|^from fitz" app/services/extractors/pymupdf.py` (real imports, not docstring) | 0 | 0 ✓ |
| `grep -c "pymupdf>=1.24" requirements.txt` | 1 | 1 ✓ |
| `grep -c "AGPL" requirements.txt` | ≥1 | 2 ✓ |
| `grep -c "test_pymupdf_fence" requirements.txt` | ≥1 | 1 ✓ |
| `grep -c "Pinned by Phase 070" requirements.txt` (D-070-14 intact) | 1 | 1 ✓ |
| `grep -c "supabase==2.29.0" requirements.txt` (D-v2.6-01 intact) | 1 | 1 ✓ |
| `grep -c "httpx>=0.28.0,<0.29.0" requirements.txt` (D-v2.6-01 intact) | 1 | 1 ✓ |
| `grep -c "docling>=2.93.0" requirements.txt` (D-v2.6-01 intact) | ≥1 | 1 ✓ |
| `grep -c "PYMUPDF_TIMEOUT_S=60" .env.example` | 1 | 1 ✓ |
| `grep -c "class PyMuPDFExtractor" app/services/extractors/pymupdf.py` | 1 | 1 ✓ |
| `grep -c "extractors.pymupdf_isolated" app/services/extractors/pymupdf.py` | ≥1 | 3 ✓ |
| `grep -c "if __name__" extractors/pymupdf_isolated.py` | ≥1 | 1 ✓ |
| `grep -c "class ExtractionError" app/services/extraction_service.py` | ≥1 | 1 ✓ |
| pytest test_pymupdf_fence.py exits 0 | yes | 6/6 PASS ✓ |
| pytest test_pdf_extractor_docling_compat.py exits 0 (Phase 070 gate) | yes | 1 PASS + 1 SKIP ✓ |
| D-070-14 + D-v2.6-01 lines byte-identical to pre-Plan-03 state | yes | confirmed via `git diff 97cff11:backend/requirements.txt` ✓ |

## Deviations

### Auto-fixed Issues

**1. [Rule 1 - Bug] PyMuPDF 1.27 `find_tables` polluted stdout with a marketing nudge, corrupting the JSON IPC contract**

- **Found during:** Task 1 smoke test (immediately after writing the verbatim RESEARCH.md Pattern 3 child entrypoint)
- **Issue:** `page.find_tables()` in PyMuPDF 1.27.2 prints the string `"Consider using the pymupdf_layout package for a greatly improved page layout analysis.\n"` directly to Python's `sys.stdout`. Because the child's stdout IS the parent's JSON IPC channel, every extract was producing `b"Consider using the pymupdf_layout package…\n{\"text\": …}"` — invalid JSON, `JSONDecodeError` on `json.loads(result.stdout)` in any caller. The verbatim Pattern 3 from RESEARCH.md did not anticipate this 1.27-only behavior (Pattern 3 was authored on a pre-1.27 PyMuPDF venv).
- **Fix:** Added a `_redirect_stdout_to_stderr()` context manager in `pymupdf_isolated.py` that swaps `sys.stdout` to `sys.stderr` around the `page.find_tables()` call. The nudge surfaces as a diagnostic on stderr (preserved for debugging) but cannot corrupt stdout JSON. Initial attempt used `os.dup2` at the file-descriptor level (in case the message came from C-level MuPDF code), but smoke-test traces showed the marketing print goes through Python's `TextIOWrapper` buffer — the Python-level `sys.stdout` swap reliably catches it. Confirmed via `cd backend && venv/Scripts/python -m extractors.pymupdf_isolated --mime application/pdf < tests/fixtures/extraction/reference.pdf 1>out.txt 2>err.txt` — stdout now starts with `{"text": "..."` and the nudge appears in err.txt.
- **Files modified:** `backend/extractors/pymupdf_isolated.py` (added `import contextlib`, removed unused `import os`, added `_redirect_stdout_to_stderr` helper, wrapped `tabs = page.find_tables()` in `with _redirect_stdout_to_stderr():`)
- **Commit:** `7d80ee4` (bundled into Task 1)

### Non-deviations (worth flagging)

- **Acceptance criterion #8 grep `grep -c "import fitz" backend/app/services/extractors/pymupdf.py` returns `1`.** This matches the docstring text `"This file MUST NOT \`import fitz\` or \`from pymupdf\` anywhere."` — NOT a real import statement. The stricter regex `grep -cE "^import fitz|^from fitz|^[[:space:]]+import fitz|^[[:space:]]+from fitz" app/services/extractors/pymupdf.py` returns 0. Semantic correctness is enforced by the runtime invariant test, which passes.

- **CRLF warnings on new Python files.** Git showed `LF will be replaced by CRLF the next time Git touches it` on commit for `extractors/__init__.py`, `extractors/pymupdf_isolated.py`, `app/services/extractors/pymupdf.py`, `tests/integration/test_pymupdf_fence.py`, `.env.example`. Same harmless pattern as Plan 02 (which had it on `academic_synth.{pdf,docx}`). No action needed — git's autocrlf handling on Windows preserves canonical LF in the repo blobs.

- **`fitz` appears function-locally in `backend/scripts/probe_multimodal.py`.** The probe script imports `fitz` inside `probe_pymupdf()` (function-local). Because the test harness's `test_fitz_not_imported_by_parent` only imports the parent-side runtime modules (`extraction_service`, `extractors.docling`, `extractors.pymupdf`, `app.api.documents`), the probe script's function-local import is never executed during normal operation — `fitz` does NOT leak into `sys.modules`. The probe is a dev-only diagnostic, never invoked by the FastAPI parent process. No action needed.

## Issues Encountered

- The PyMuPDF 1.27 stdout-pollution bug (above) was the only friction point. Investigation took ~10 minutes (smoke test → trace `find_tables` specifically → confirm Python-level stdout vs C-level fd → choose Python `sys.stdout` swap). Total fix was ~15 lines of additional code (context manager + import + 2 wrappers).

## Sys.modules Snapshot (parent-side import audit)

Captured by `python -c "import sys, importlib; importlib.import_module('app.services.extraction_service'); importlib.import_module('app.services.extractors.docling'); importlib.import_module('app.services.extractors.pymupdf'); importlib.import_module('app.api.documents'); ..."`:

- **Forbidden imports present:** `[]` (empty set — `fitz`, `pymupdf`, `PyMuPDF` all absent) — FENCE HOLDS
- **`subprocess` present:** True (the IPC channel)
- **`json` present:** True (JSON parse on stdout)
- **`pathlib` present:** True (path resolution)
- **`_BACKEND_DIR` resolved value:** `C:\Vibe Apps\Agentic RAG\backend` (absolute path to backend/ — matches `cd backend` from project root)

## Windows-specific Quirks

None observed in this plan. The known `subprocess.TimeoutExpired` SIGKILL-on-POSIX / TerminateProcess-on-Windows split (RESEARCH.md Pitfall 5) is handled by the standard library — our wrapper raises `ExtractionError("pymupdf timed out after Ns")` in both cases. No zombie-child cleanup observed during the test suite or the smoke tests.

## D-070-14 / D-v2.6-01 Tripwire Verification

Direct `git diff` between the previous commit (`97cff11`, end of Plan 02) and the current Plan 03 commits for `backend/requirements.txt`:

- Lines added: 9 (the new AGPL fence comment block + `pymupdf>=1.24` pin + one blank line for visual separation)
- Lines removed: 0
- Lines modified: 0
- **D-070-14 comment block (lines 4-7 of pre-Plan-03):** byte-identical post-Plan-03 (now lines 4-7 still — no shift)
- **`supabase==2.29.0` line:** byte-identical
- **`httpx>=0.28.0,<0.29.0` line:** byte-identical (still at requirements.txt line 27 in post-Plan-03)
- **`docling>=2.93.0,<3.0.0` line:** byte-identical (still at requirements.txt last position)

Confirmed by running `cd backend && git show 97cff11:backend/requirements.txt > /tmp/req.before && diff /tmp/req.before requirements.txt` — the diff shows only the new 9-line block inserted between `pdfplumber>=0.11.0` and `Pillow>=10.0.0`.

## Known Stubs

None. Every code path introduced in this plan does real work:
- The child entrypoint actually runs `fitz` and produces a real `ExtractedDocument`-shaped JSON payload.
- The parent wrapper actually spawns a real subprocess, captures real stdout/stderr, parses real JSON.
- The test suite exercises real `subprocess.run` calls AND a `subprocess.TimeoutExpired` patch (the only test that mocks anything — done because real-clock timeouts are flaky in CI).

The dispatcher seam in `extraction_service.get_extractor()` was already in place from Plan 02 (`_PYMUPDF` lazy-import branch with ImportError guard). Now that `app/services/extractors/pymupdf.py` exists, the dispatcher resolves `PyMuPDFExtractor` automatically when `EXTRACTOR_PRIMARY=pymupdf` or when a `/reextract` caller passes `engine_override="pymupdf"` (Plan 04's surface).

## Next Phase Readiness

- **Plan 04 (`POST /reextract`)** can now invoke the PyMuPDF engine via `engine_override="pymupdf"` — `ingest_document` already accepts the kwarg (Plan 02), and the dispatcher will resolve `PyMuPDFExtractor` cleanly.
- **Phase 072 (RAG-MM-LIFT-01/02)** inherits the new `bbox` field plumbed through ExtractedDocument; the PyMuPDF child currently emits table `bbox` from `t.bbox[0..3]` but leaves image `bbox = None` (PyMuPDF image extraction doesn't carry layout coordinates the way Docling does). Phase 072 will wire those bbox values to `document_tables.bbox` / `document_images.bbox` columns (migrations 041/042).
- **Phase 076 (extraction-comparison UAT)** can now run Docling, PyMuPDF, and Legacy on the same input via `/reextract` with three engine overrides + compare telemetry rows in `pdf_extraction_runs`.

## Self-Check: PASSED

- All files in `files_modified` exist on disk:
  - `backend/extractors/__init__.py` ✓
  - `backend/extractors/pymupdf_isolated.py` ✓
  - `backend/app/services/extractors/pymupdf.py` ✓
  - `backend/app/services/extraction_service.py` ✓ (modified, ExtractionError added)
  - `backend/requirements.txt` ✓ (modified, pymupdf>=1.24 inserted)
  - `backend/.env.example` ✓ (modified, PYMUPDF_TIMEOUT_S=60 appended)
  - `backend/tests/integration/test_pymupdf_fence.py` ✓
- All 4 task commits found in git log:
  - `7d80ee4` (Task 1) ✓
  - `2295cf0` (Task 2) ✓
  - `a7e026e` (Task 3) ✓
  - `fd2c4f8` (Task 4) ✓
- All 22 plan-level acceptance criteria pass (see verification table above).
- AGPL fence invariant: `fitz` never enters parent `sys.modules` — confirmed empirically AND by passing test.
- Phase 070 binding gate (`test_pdf_extractor_docling_compat.py`) stays GREEN.
- D-070-14 / D-v2.6-01 lines byte-identical to pre-Plan-03 state — confirmed via `git diff`.
