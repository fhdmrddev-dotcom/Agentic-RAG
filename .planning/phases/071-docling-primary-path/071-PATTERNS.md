# Phase 071: Docling Primary Path — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 22 (13 NEW + 9 MODIFIED — see CONTEXT.md "Code surfaces touched")
**Analogs found:** 22 / 22 (every file has a strong in-repo analog or a verbatim reference impl in RESEARCH.md Code Examples)

---

## File Classification

### NEW files (Plan 02 — Docling extractor + dispatcher)

| File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/extractors/docling.py` | service / extractor | request-response (sync, threadpool) | `backend/app/services/extraction_service.py:90-174` (`LegacyExtractor`) + RESEARCH.md §Code Examples lines 944-1117 (verbatim reference impl) | exact (role + data flow) |

### NEW files (Plan 03 — PyMuPDF subprocess fence)

| File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/extractors/pymupdf.py` | service / extractor wrapper | subprocess request-response (parent side) | `backend/app/services/extraction_service.py:90-174` (`LegacyExtractor` ABC contract) + RESEARCH.md §Pattern 2 (lines 369-401) | exact (parent wrapper shape) |
| `backend/extractors/__init__.py` | package marker | n/a | `backend/tests/__init__.py` (empty pkg-marker pattern in repo) | role-match (empty file) |
| `backend/extractors/pymupdf_isolated.py` | service / subprocess child | stdin-bytes → stdout-JSON | RESEARCH.md §Pattern 3 (lines 403-518) — full verbatim reference impl verified against PyMuPDF 1.27 in venv | exact |

### NEW files (Plan 01 — migrations)

| File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/039_pdf_extraction_runs.sql` | migration / new RLS table | DDL | `supabase/migrations/035_runs_table.sql` (identical RLS template: SELECT-only `auth.uid()=user_id`, service-role writes bypass) | exact (RESEARCH.md §Don't Hand-Roll line 577 explicitly names this as template) |
| `supabase/migrations/040_documents_extractor_column.sql` | migration / ADD COLUMN + backfill | DDL + UPDATE | `supabase/migrations/037_messages_confidence_columns.sql` (idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS`) | exact (column-add idiom) |
| `supabase/migrations/041_document_images_bbox.sql` | migration / ADD COLUMN | DDL | `supabase/migrations/037_messages_confidence_columns.sql` | exact |
| `supabase/migrations/042_document_tables_bbox_extractor.sql` | migration / ADD COLUMN x2 | DDL | `supabase/migrations/037_messages_confidence_columns.sql` (multi-column `ALTER … ADD COLUMN IF NOT EXISTS` list) | exact |
| `supabase/migrations/043_documents_dedup_unique_index.sql` | migration / DELETE + partial unique index | DDL + destructive DML | `supabase/migrations/035_runs_table.sql` (partial index `WHERE status = …` template — lines 38-40) | role-match (partial index idiom — destructive DELETE has no prior analog; treat as bespoke per RESEARCH.md Pitfall + Threat T-071-01-02) |
| `supabase/migrations/044_app_settings_multimodal_limits.sql` | migration / ADD COLUMN | DDL | `supabase/migrations/010_app_settings.sql` (`app_settings` table shape) + `037_messages_confidence_columns.sql` (column-add idiom) | role-match |

### NEW files (Plan 02 + Plan 03 tests + fixtures)

| File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/tests/integration/test_docling_extractor.py` | test / integration | fixture-load + assert | `backend/tests/integration/test_pdf_extractor_docling_compat.py` (Phase 070 — same fixture-load shape, same assertion pattern) | exact |
| `backend/tests/integration/test_pymupdf_fence.py` | test / integration | subprocess + sys.modules introspection | RESEARCH.md §Pattern 4 (lines 520-550) — full verbatim invariant test | exact |
| `backend/tests/fixtures/extraction/academic_synth.pdf` | test fixture | binary artifact | `backend/tests/fixtures/extraction/reference.pdf` + generator at `backend/tests/fixtures/extraction/_generate_fixtures.py` (reportlab synth) | exact (generator pattern) |
| `backend/tests/fixtures/extraction/academic_synth.docx` | test fixture | binary artifact | `backend/tests/fixtures/extraction/reference.docx` (same generator file, python-docx branch) | exact |

### MODIFIED files

| File | Role | Data Flow | Closest Analog (within same file) | Match Quality |
|---|---|---|---|---|
| `backend/app/services/extraction_service.py` | service / ABC + dispatcher | n/a (extension) | `backend/app/services/extraction_service.py:46-66` (`ExtractedDocument` dataclass) + `:180-188` (`get_extractor` dispatcher) | self-analog (Phase 069 seam extended in-place) |
| `backend/app/api/documents.py` | route + background task | request-response + BackgroundTasks | `backend/app/api/documents.py:427-491` (`POST /reingest`) + `:634-729` (`ingest_document`) | exact (sibling pattern + same function gains `engine_override` kwarg) |
| `backend/app/models/user_settings.py` | config reader | settings resolution | `backend/app/models/user_settings.py:248-290` (`load_app_settings()` — multi-line typed-reader pattern) | exact (add two new int fields the same way) |
| `backend/tests/integration/test_documents.py` | test / integration | fastapi TestClient + mock_builder | `backend/tests/integration/test_documents.py:234-292` (existing upload/folder tests — same mock_builder.execute.side_effect pattern) | exact |
| `backend/requirements.txt` | config / pip pins | n/a | `backend/requirements.txt:4-8` (existing Phase 070 D-070-14 comment block above the `supabase==2.29.0` pin — the tripwire idiom) | exact (use the same multi-line `#` comment block format directly above the new `pymupdf>=1.24` line) |
| `backend/.env.example` | config / env example | n/a | `backend/.env.example:12-21` (existing section headers + sample-value-with-comment pattern) | exact |
| `README.md` (project root — `backend/README.md` does NOT exist) | docs | n/a | n/a — Plan 04 appends a runbook line; surface to user during plan-phase if a new `backend/README.md` should be created instead | partial (no analog — Plan 04 task picks file) |

---

## Pattern Assignments

### 1. `backend/app/services/extractors/docling.py` (NEW — Plan 02)

**Primary analog:** `backend/app/services/extraction_service.py:90-174` (`LegacyExtractor` — the existing PdfExtractor subclass).
**Reference impl:** RESEARCH.md §Code Examples lines 944-1117 (verbatim, verified live against Docling 2.93 on 2026-05-14).

#### Imports + `from __future__` pattern

Lifted directly from `extraction_service.py:14-21`:
```python
# extraction_service.py:14-21
from __future__ import annotations

import io
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

log = logging.getLogger(__name__)
```

**Apply to `docling.py`:** same `from __future__ import annotations` + `log = logging.getLogger(__name__)` header; add `import base64, io, threading, time`; lazy heavy imports inside `_get_converter()` per Pattern 1 / D-071-06.

#### ABC subclass + `supports` / `extract` contract

From `extraction_service.py:90-129` (`LegacyExtractor`):
```python
class LegacyExtractor(PdfExtractor):
    """Today's pipeline: pypdf for PDF text, pdfplumber for PDF tables/images,
    python-docx for DOCX. Wrapped under the new ABC seam for Phase 071 swap.
    """

    def supports(self, mime: str) -> bool:
        return mime in (PDF_MIME, DOCX_MIME)

    def extract(self, raw: bytes, mime: str) -> ExtractedDocument:
        if not self.supports(mime):
            raise ValueError(f"LegacyExtractor does not support {mime!r}")

        # Text — raises on failure (matches today's extract_text() semantics, D-069-04)
        text = self._extract_text(raw, mime)

        # Tables — silent-swallow translated to error field (D-069-04)
        tables: list[TableData] = []
        table_error: str | None = None
        try:
            tables = self._extract_tables(raw, mime)
        except Exception as exc:  # noqa: BLE001 — intentional broad-catch per D-069-04
            table_error = str(exc)
            log.warning("LegacyExtractor table extraction failed: %s", exc)

        # Images — silent-swallow translated to error field (D-069-04)
        images: list[ImageData] = []
        image_error: str | None = None
        try:
            images = self._extract_images(raw, mime)
        except Exception as exc:  # noqa: BLE001 — intentional broad-catch per D-069-04
            image_error = str(exc)
            log.warning("LegacyExtractor image extraction failed: %s", exc)

        return ExtractedDocument(
            text=text,
            tables=tuple(tables),
            images=tuple(images),
            table_extraction_error=table_error,
            image_extraction_error=image_error,
        )
```

**Apply to `DoclingExtractor`:** same ABC subclass shape, same `if not self.supports(mime): raise ValueError(...)` guard, same try/except-per-extraction-mode silent-swallow contract (D-069-04 inherited). Add `extractor_name="docling"` + `full_markdown=...` to the returned `ExtractedDocument`.

#### Lazy heavy-import pattern (project convention)

From `extraction_service.py:131-141` (`_extract_text`):
```python
def _extract_text(self, raw: bytes, mime: str) -> str:
    """Port of `documents.extract_text` PDF + DOCX branches (lines 45-52)."""
    if mime == PDF_MIME:
        from pypdf import PdfReader  # noqa: PLC0415 — lazy heavy import
        reader = PdfReader(io.BytesIO(raw))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    if mime == DOCX_MIME:
        from docx import Document as DocxDocument  # noqa: PLC0415 — lazy heavy import
        doc = DocxDocument(io.BytesIO(raw))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    raise ValueError(f"_extract_text: unsupported mime {mime!r}")
```

**Apply:** Docling imports live inside `_get_converter()` (lazy) — `from docling.document_converter import DocumentConverter, PdfFormatOption  # noqa: PLC0415` etc. `# noqa: PLC0415` suppression is the project-canonical signal for intentional lazy heavy import.

#### Singleton + double-checked-lock

From RESEARCH.md §Pattern 1 (lines 336-367) — copy verbatim:
```python
import threading

_CONVERTER: "DocumentConverter | None" = None
_CONVERTER_LOCK = threading.Lock()


def _get_converter() -> "DocumentConverter":
    global _CONVERTER
    if _CONVERTER is None:
        with _CONVERTER_LOCK:
            if _CONVERTER is None:
                from docling.document_converter import DocumentConverter, PdfFormatOption  # noqa: PLC0415
                from docling.datamodel.base_models import InputFormat  # noqa: PLC0415
                from docling.datamodel.pipeline_options import PdfPipelineOptions  # noqa: PLC0415

                opts = PdfPipelineOptions()
                opts.generate_picture_images = True   # required for p.get_image(doc) — Pitfall 3
                opts.images_scale = 2.0
                opts.document_timeout = 120.0         # T-071-02-03 mitigation
                _CONVERTER = DocumentConverter(
                    format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
                )
    return _CONVERTER
```

#### Docling → ExtractedDocument adapter

Full verbatim mapping at RESEARCH.md lines 944-1117 (`_to_table_data`, `_to_image_data`, `DoclingExtractor.extract` body). Adapter table at RESEARCH.md lines 666-722 — every field verified live against Docling 2.93 on 2026-05-14. **Plan 02 copies this code verbatim, no design decisions left.**

#### Temp-file pattern (Docling `convert()` takes a path, not bytes)

From `backend/scripts/probe_multimodal.py:196-218` — exact pattern to reuse:
```python
# probe_multimodal.py:196-218
import tempfile
with tempfile.NamedTemporaryFile(suffix=os.path.splitext(filename)[1] or ".pdf", delete=False) as tf:
    tf.write(raw)
    tmp_path = tf.name
try:
    converter = DocumentConverter()
    result = converter.convert(tmp_path)
    doc = result.document
    ...
finally:
    try:
        os.unlink(tmp_path)
    except Exception:
        pass
```

---

### 2. `backend/app/services/extractors/pymupdf.py` (NEW — Plan 03, parent wrapper)

**Primary analog:** `LegacyExtractor` ABC shape (above) + RESEARCH.md §Pattern 2 (lines 369-401, verbatim).

**Key constraint:** NO `import fitz` anywhere in this file — D-071-04 AGPL fence; verified by `test_pymupdf_fence.py` runtime invariant.

#### Subprocess invocation pattern (verbatim from RESEARCH.md §Pattern 2)

```python
import subprocess, json, os

def _run_pymupdf_subprocess(raw: bytes, mime: str) -> "ExtractedDocument":
    timeout_s = int(os.getenv("PYMUPDF_TIMEOUT_S", "60"))
    try:
        result = subprocess.run(
            ["python", "-m", "extractors.pymupdf_isolated", "--mime", mime],
            input=raw,                  # raw bytes, NOT b64 — D-071-01
            capture_output=True,        # stdout = JSON; stderr = diagnostic logs
            timeout=timeout_s,
            check=False,                # we handle non-zero exit explicitly
            # cwd resolved to backend/ at module-import time — T-071-03-05 mitigation
            cwd=str(_BACKEND_DIR),
            # Pass a minimal env to the child — T-071-03-01 (no SUPABASE_SERVICE_ROLE_KEY etc.)
            env={"PATH": os.environ.get("PATH", "")},
        )
    except subprocess.TimeoutExpired as e:
        raise ExtractionError(f"pymupdf timed out after {timeout_s}s") from e

    if result.returncode != 0:
        last_err = result.stderr.decode("utf-8", errors="replace").strip().splitlines()[-1:]
        raise ExtractionError(f"pymupdf child exited {result.returncode}: {last_err[0] if last_err else 'no stderr'}")

    payload = json.loads(result.stdout.decode("utf-8"))
    return _payload_to_extracted_document(payload)
```

**Threat-model annotations to apply:**
- T-071-03-05 → resolve `_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent` (= `backend/`) at module import.
- T-071-03-01 → pass `env={"PATH": ...}` to strip Supabase service-role creds from the child.
- T-071-03-06 → `capture_output=True` already buffers to memory; no pipe-buffer deadlock risk.

#### `_payload_to_extracted_document` reverse-translator

JSON child payload → dataclass shape — pattern mirrors `LegacyExtractor._extract_tables` (`extraction_service.py:143-158`):
```python
# extraction_service.py:143-158 (pattern for dict → dataclass conversion)
if mime == PDF_MIME:
    dicts = extract_pdf_tables(raw)
elif mime == DOCX_MIME:
    dicts = extract_docx_tables(raw)
else:
    return []
return [TableData(**d) for d in dicts]
```

**Apply:** payload dict from child stdout has keys matching the extended `TableData` / `ImageData` field names (per RESEARCH.md §Pattern 3 lines 446-481). Use `TableData(**d) for d in payload["tables"]` directly.

---

### 3. `backend/extractors/pymupdf_isolated.py` (NEW — Plan 03, child entrypoint)

**Reference impl:** RESEARCH.md §Pattern 3 (lines 403-518) — full file content, verified against PyMuPDF 1.27.2 in venv 2026-05-14.

**Key invariants enforced by file location:**
- Lives at `backend/extractors/`, NOT `backend/app/extractors/` (D-071-04 — AGPL structural fence at file-tree level).
- Only file in the repo allowed to contain `import fitz`. Test `test_pymupdf_fence.py` enforces this at runtime.

**Verbatim file body:** lines 407-517 of RESEARCH.md. Plan 03 copies as-is; no design decisions left.

**Critical line — the ONE `import fitz` in the whole codebase:**
```python
# backend/extractors/pymupdf_isolated.py — Pattern 3 line 424
import fitz  # PyMuPDF — AGPL-3.0; lives ONLY in this file.
```

---

### 4. `backend/extractors/__init__.py` (NEW — Plan 03)

Empty file (package marker). Pattern: every other `__init__.py` in this repo (e.g., `backend/app/__init__.py`).

---

### 5. `supabase/migrations/039_pdf_extraction_runs.sql` (NEW — Plan 01)

**Primary analog:** `supabase/migrations/035_runs_table.sql` (lines 1-54) — the project-canonical telemetry-table template. RESEARCH.md §Don't Hand-Roll line 577 explicitly names this file.

**Frontmatter / comment block pattern** (`035_runs_table.sql:1-18`):
```sql
-- Migration 035: per-run lifecycle metadata for run-backed streaming
-- Phase 061 (D-v2.5-08, D-v2.5-11). Companion to ...
--
-- D-061-05: PK = run_id uuid DEFAULT gen_random_uuid() (server-generated).
-- D-061-06: FK CASCADE on both thread_id (→ public.threads) and user_id ...
-- D-061-08: RLS — SELECT-only policy `runs_select_own` (auth.uid() = user_id).
--           No INSERT/UPDATE/DELETE policies; backend uses service-role
--           which bypasses RLS for all writes.
```

**Apply to 039:** same comment-header style; cite D-071-XX decisions; explicitly call out "service-role writes bypass RLS by design".

**CREATE TABLE + FK pattern** (`035_runs_table.sql:20-33`):
```sql
CREATE TABLE IF NOT EXISTS public.runs (
  run_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id    uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  status        text NOT NULL CHECK (status IN ('streaming','completed','failed','cancelled')),
  model         text NOT NULL,
  provider      text NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  input_tokens  integer,
  output_tokens integer,
  error         text
);
```

**Apply to 039:** `id uuid PK gen_random_uuid()`, `document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `engine text NOT NULL`, `started_at timestamptz NOT NULL DEFAULT now()`, `completed_at timestamptz`, `duration_ms integer`, `table_count integer`, `image_count integer`, `error text`. **Per CONTEXT.md T-071-01-06: ship WITHOUT a CHECK constraint on `engine`** — keeps schema relaxed for future `pypdfium2` etc.

**RLS pattern** (`035_runs_table.sql:47-53`) — copy verbatim:
```sql
-- D-061-08: SELECT-only RLS via auth.uid() = user_id. Backend writes go
-- through service-role and bypass RLS by design.
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY runs_select_own
  ON public.runs FOR SELECT
  USING (auth.uid() = user_id);
```

Rename policy to `pdf_extraction_runs_select_own`.

---

### 6. `supabase/migrations/040_documents_extractor_column.sql` (NEW — Plan 01)

**Primary analog:** `supabase/migrations/037_messages_confidence_columns.sql` (lines 1-25) — the project-canonical "ALTER TABLE … ADD COLUMN IF NOT EXISTS" idiom.

**Verbatim pattern** (`037_messages_confidence_columns.sql:18-24`):
```sql
-- IF NOT EXISTS guard: idempotent — safe to re-run against environments where the
-- columns happen to already exist (e.g. a pristine DB rebuilt from the old 000 file).

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS confidence_level         text,
  ADD COLUMN IF NOT EXISTS confidence_avg_similarity double precision,
  ADD COLUMN IF NOT EXISTS confidence_disclaimer    text;
```

**Apply to 040:**
```sql
-- Migration 040: Document extractor lineage column (Phase 071 D-071-08, Q-v2.6-04 LOCKED).
--
-- Per Q-v2.6-04: NO auto-re-extract on deploy. Backfill tags existing rows
-- 'pypdf-legacy' (informational only); new uploads default to EXTRACTOR_PRIMARY
-- env var ('docling' as of Phase 071).
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS extractor text;

-- One-time backfill (idempotent: only touches NULL rows — T-071-01-01)
UPDATE public.documents SET extractor = 'pypdf-legacy' WHERE extractor IS NULL;
```

---

### 7. `supabase/migrations/041_document_images_bbox.sql` + `042_document_tables_bbox_extractor.sql` (NEW — Plan 01)

**Primary analog:** same `037_messages_confidence_columns.sql` ADD COLUMN idiom.

**Existing target table shapes** (`030_missing_tables.sql:83-93` for `document_tables`, lines 108-116 for `document_images`):
```sql
-- 030_missing_tables.sql:83-93
CREATE TABLE IF NOT EXISTS public.document_tables (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page        integer,
  table_index integer NOT NULL,
  headers     jsonb NOT NULL DEFAULT '[]',
  rows        jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

**Apply to 041:**
```sql
ALTER TABLE public.document_images
  ADD COLUMN IF NOT EXISTS bbox jsonb;
```

**Apply to 042:**
```sql
ALTER TABLE public.document_tables
  ADD COLUMN IF NOT EXISTS bbox      jsonb,
  ADD COLUMN IF NOT EXISTS extractor text;
```

---

### 8. `supabase/migrations/043_documents_dedup_unique_index.sql` (NEW — Plan 01)

**Partial-index pattern analog:** `035_runs_table.sql:38-40`:
```sql
-- 035_runs_table.sql:38-40
CREATE INDEX IF NOT EXISTS idx_runs_active
  ON public.runs (user_id, thread_id, status)
  WHERE status = 'streaming';
```

**Apply (per RESEARCH.md Migration Verification Matrix line 790):**
```sql
-- Migration 043: documents dedup unique index (CQ-DEDUP-01, PRD §6 row 8).
--
-- DESTRUCTIVE: deletes pre-existing duplicate rows (keeps oldest ctid per group)
-- BEFORE creating the index. Plan 01 verifier MUST run a dry-run SELECT first
-- showing the count of duplicates and surface to user (T-071-01-02).

-- (a) One-time DELETE — keeps OLDEST row per (user_id, content_hash, folder_id)
DELETE FROM public.documents
WHERE status != 'failed'
  AND ctid NOT IN (
    SELECT MIN(ctid) FROM public.documents
    WHERE status != 'failed'
    GROUP BY user_id, content_hash, folder_id
  );

-- (b) Partial unique index — race-free dedup going forward
CREATE UNIQUE INDEX IF NOT EXISTS documents_dedup_idx
  ON public.documents (user_id, content_hash, folder_id)
  WHERE status != 'failed';
```

**Critical:** RESEARCH.md §Runtime State Inventory line 594 — Plan 01 task MUST capture a pre-DELETE dry-run row count and surface to user before applying.

---

### 9. `supabase/migrations/044_app_settings_multimodal_limits.sql` (NEW — Plan 01)

**Primary analogs:**
- `supabase/migrations/010_app_settings.sql:5-30` — existing `app_settings` table shape (single global row, `id text PRIMARY KEY DEFAULT 'global'`, nullable columns).
- `037_messages_confidence_columns.sql` — ADD COLUMN idiom.

**Apply:**
```sql
-- Migration 044: app_settings multimodal limit columns (Phase 071 lays the
-- contract; Phase 072 RAG-MM-LIFT-01 actually USES these in multimodal_service).
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS multimodal_max_vision_calls integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS multimodal_max_b64_bytes_kb integer DEFAULT 4096;
```

Plus the `user_settings.py` reader hookup — see §13 below.

---

### 10. `backend/tests/integration/test_docling_extractor.py` (NEW — Plan 02)

**Primary analog:** `backend/tests/integration/test_pdf_extractor_docling_compat.py` (Phase 070 output).

#### Imports + fixture-path pattern (verbatim from `test_pdf_extractor_docling_compat.py:1-12`)

```python
"""Phase 070 SC#2: Docling + supabase-py coexistence CI gate (Q-v2.6-01 resolution test)."""
import os
from pathlib import Path

import pytest

# Module-top imports: spike must fail loudly at collection if either lib is broken.
# (Diverges from probe_multimodal.py's lazy import — Pitfall #1.)
from docling.document_converter import DocumentConverter
from supabase import create_client

FIXTURE_PATH = Path(__file__).parent.parent / "fixtures" / "extraction" / "reference.pdf"
```

**Apply to `test_docling_extractor.py`:** same `from pathlib import Path` + same `FIXTURE_PATH = Path(__file__).parent.parent / "fixtures" / "extraction" / "academic_synth.pdf"`. Module-top `from app.services.extractors.docling import DoclingExtractor` (fail loudly at collection if import broken — matches Phase 070 spike posture).

#### Assertion shape (Phase 070 lines 15-31)

```python
def test_docling_supabase_coexist():
    """D-070-01: import + instantiate both libs in one process; Docling convert returns non-empty markdown."""
    assert FIXTURE_PATH.exists(), f"Missing reference fixture: {FIXTURE_PATH}"

    # Docling: full convert + non-empty assertion.
    converter = DocumentConverter()
    result = converter.convert(str(FIXTURE_PATH))
    markdown = result.document.export_to_markdown()
    assert isinstance(markdown, str) and len(markdown) > 0, (
        f"Docling produced empty markdown for {FIXTURE_PATH}; got {markdown!r}"
    )
```

**Apply to Plan 02 tests:**
1. `test_docling_pdf_synthetic_extract` — load `academic_synth.pdf`, run `DoclingExtractor().extract(raw, "application/pdf")`, assert `len(out.text) > 0`, `len(out.tables) >= 1` (synthetic has ≥ 5), `len(out.images) >= 1`, `out.extractor_name == "docling"`, `out.full_markdown is not None`.
2. Same shape for `academic_synth.docx`.
3. `test_docling_bbox_populated` — assert `out.tables[0].bbox is not None` and contains keys `{"l", "t", "r", "b", "page"}` (per RESEARCH.md adapter mapping line 697).

---

### 11. `backend/tests/integration/test_pymupdf_fence.py` (NEW — Plan 03)

**Reference impl:** RESEARCH.md §Pattern 4 (lines 520-550) — full verbatim invariant test. Plan 03 copies as-is.

**Plus** a child-as-subprocess flavor (the "child runs cleanly" test) — pattern derives from `subprocess.run` invocation in §Pattern 2 above. RESEARCH.md §Plan 03 threat model rows give the test cases:
- `test_fitz_not_imported_by_parent` — verbatim from Pattern 4 (T-071-03-04).
- `test_pymupdf_child_extracts_synthetic_pdf` — invoke subprocess, parse JSON, assert tables/images counts (T-071-03-02).
- `test_pymupdf_child_timeout_raises` — pass a sleep-loop synth payload, assert `ExtractionError("pymupdf timed out after Ns")` (T-071-03-03).
- `test_pymupdf_child_strips_supabase_env` — set `SUPABASE_SERVICE_ROLE_KEY=tripwire` in parent env, run child, assert child's env didn't see it (T-071-03-01).

---

### 12. `backend/tests/fixtures/extraction/academic_synth.{pdf,docx}` (NEW — Plan 02)

**Generator pattern analog:** `backend/tests/fixtures/extraction/_generate_fixtures.py` (existing reference fixture generator). Match its file-header docstring + reportlab + python-docx + PIL pattern.

Excerpt from `_generate_fixtures.py:1-35`:
```python
"""
One-time reference-fixture generator for Phase 069 extraction tests.

Synthesizes `reference.pdf` and `reference.docx` — license-clean, ~1-2 MB each,
containing body text + one simple table + one small embedded PNG image.
...
Run manually from `backend/`:

    venv/Scripts/python tests/fixtures/extraction/_generate_fixtures.py
"""
from __future__ import annotations
import io
from pathlib import Path
from PIL import Image as PILImage

HERE = Path(__file__).resolve().parent
PDF_PATH = HERE / "reference.pdf"
DOCX_PATH = HERE / "reference.docx"
```

**Apply to academic-synth generator:** add new functions `generate_academic_pdf()` + `generate_academic_docx()` to the SAME file (or sibling `_generate_academic_fixtures.py`). Output `~5 tables + 5 embedded PNGs` per CONTEXT.md D-071-16. Commit the resulting binary fixtures.

---

### 13. `backend/app/services/extraction_service.py` (MODIFIED — Plan 02)

#### Extend `ExtractedDocument` / `TableData` / `ImageData` (D-071-08)

Current shape (`extraction_service.py:27-65`) — extend in-place:
```python
@dataclass(frozen=True)
class TableData:
    page: int | None
    table_index: int
    headers: list[str]
    rows: list[list[str]]
    # NEW per D-071-08:
    bbox: dict | None = None

@dataclass(frozen=True)
class ImageData:
    page: int | None
    image_index: int
    b64_png: str
    width: int
    height: int
    # NEW per D-071-08:
    bbox: dict | None = None

@dataclass(frozen=True)
class ExtractedDocument:
    text: str
    tables: tuple[TableData, ...]
    images: tuple[ImageData, ...]
    table_extraction_error: str | None = None
    image_extraction_error: str | None = None
    # NEW per D-071-08:
    full_markdown: str | None = None
    extractor_name: str | None = None
```

**Backward-compat guarantee:** all new fields default to `None`. Existing Phase 069 golden tests stay green; `LegacyExtractor` may optionally set `extractor_name='pypdf-legacy'` for clarity (CONTEXT.md Discretion: "recommend explicit for clarity").

#### Extend `get_extractor` dispatcher (D-071-12)

Current shape (`extraction_service.py:180-188`):
```python
_LEGACY = LegacyExtractor()  # stateless — safe to share


def get_extractor(mime: str) -> PdfExtractor | None:
    """Return an extractor that supports `mime`, or None.

    Phase 069: always returns LegacyExtractor for PDF/DOCX, None otherwise.
    Phase 071: will consult app_settings/env to pick between engines.
    """
    if _LEGACY.supports(mime):
        return _LEGACY
    return None
```

**Apply Phase 071 extension** (per D-071-12):
```python
import os

_LEGACY = LegacyExtractor()
_DOCLING: "DoclingExtractor | None" = None
_PYMUPDF: "PyMuPDFExtractor | None" = None
_PRIMARY_CACHED: str | None = None


def _read_primary() -> str:
    global _PRIMARY_CACHED
    if _PRIMARY_CACHED is None:
        raw = os.getenv("EXTRACTOR_PRIMARY", "docling")
        if raw not in ("docling", "pymupdf", "legacy"):
            log.warning("Invalid EXTRACTOR_PRIMARY=%r; falling through to 'docling'", raw)
            raw = "docling"
        _PRIMARY_CACHED = raw
    return _PRIMARY_CACHED


def get_extractor(mime: str, engine_override: str | None = None) -> PdfExtractor | None:
    global _DOCLING, _PYMUPDF
    engine = engine_override or _read_primary()

    if engine == "docling":
        if _DOCLING is None:
            from app.services.extractors.docling import DoclingExtractor  # noqa: PLC0415
            _DOCLING = DoclingExtractor()
        if _DOCLING.supports(mime):
            return _DOCLING

    if engine == "pymupdf":
        if _PYMUPDF is None:
            from app.services.extractors.pymupdf import PyMuPDFExtractor  # noqa: PLC0415
            _PYMUPDF = PyMuPDFExtractor()
        if _PYMUPDF.supports(mime):
            return _PYMUPDF

    # 'legacy' OR fall-through when chosen engine doesn't support the mime
    if _LEGACY.supports(mime):
        return _LEGACY
    return None
```

---

### 14. `backend/app/api/documents.py` (MODIFIED — Plan 02 + Plan 04)

#### Existing dispatcher call sites — NO change needed (Phase 069 seam already in place)

Upload path (`documents.py:226-239`):
```python
# documents.py:226-239 — already routes through PdfExtractor seam
from app.services.extraction_service import get_extractor  # noqa: PLC0415

try:
    extractor = get_extractor(mime_type)
    if extractor is not None:
        text = extractor.extract(raw, mime_type).text
    else:
        text = extract_text(raw, mime_type)
except Exception as e:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Could not extract text from file: {e}",
    )
```

Same shape at `documents.py:456-467` for `/reingest`.

**Apply:** no edits to upload/reingest dispatcher call sites — the new `get_extractor` signature is backward-compatible (`engine_override=None` default). `/reextract` (new) is the only caller that passes the kwarg.

#### `/reextract` route — full reference impl

RESEARCH.md §Code Examples lines 1154-1237 — verbatim, copy-pasteable. Critical patterns lifted from `/reingest` at `documents.py:427-491`:

**Auth + ownership check pattern** (`documents.py:436-446` — copy verbatim):
```python
# documents.py:436-446
doc = (
    supabase.table("documents")
    .select("*")
    .eq("id", document_id)
    .eq("user_id", current_user["id"])
    .eq("is_latest", True)
    .maybe_single()
    .execute()
)
if not doc.data:
    raise HTTPException(status_code=404, detail="Document not found")

target = doc.data
```

**Storage fetch pattern** (`documents.py:451-454`):
```python
try:
    raw = supabase.storage.from_("documents").download(target["file_path"])
except Exception as e:
    raise HTTPException(status_code=502, detail=f"Could not retrieve stored file: {e}")
```

**BackgroundTask schedule pattern** (`documents.py:481-491`):
```python
background_tasks.add_task(
    ingest_document,
    document_id,
    text,
    current_user["id"],
    supabase,
    raw,
    target["mime_type"],
    target["filename"],
)
```

**`/reextract` adds:** Pydantic body `ReextractRequest(engine: Literal["docling","pymupdf","legacy"])`, 3 hard-delete statements before scheduling (per D-071-10), passes new `engine_override` kwarg into `ingest_document`, returns 202.

#### `ingest_document` — extend signature + add telemetry

Current signature (`documents.py:634-642`):
```python
def ingest_document(
    document_id: str,
    text: str,
    user_id: str,
    supabase: Client,
    raw: bytes = b"",
    mime_type: str = "",
    filename: str = "",
) -> None:
```

**Apply:** add `engine_override: str | None = None` as last kwarg.

#### Telemetry write — pattern from RESEARCH.md Code Examples lines 1119-1152

**Existing successful-completion pattern at `documents.py:716-722`:**
```python
# documents.py:716-722
supabase.table("documents").update({"ingestion_step": "metadata"}).eq("id", document_id).execute()
supabase.table("documents").update({
    "status": "completed",
    "chunk_count": len(chunks),
    "metadata": metadata_dict,
    "full_markdown": text,
}).eq("id", document_id).execute()
```

**Existing failed-completion pattern at `documents.py:724-729` (D-071-11 inherits this verbatim):**
```python
# documents.py:724-729 — Docling failure path bottoms out here per D-071-11
except Exception as e:
    log.error("ingest_document failed: %s\n%s", e, traceback.format_exc())
    supabase.table("documents").update({
        "status": "failed",
        "error_message": str(e)[:500],
    }).eq("id", document_id).execute()
```

**Apply Phase 071 additions:**
1. Capture `extract_start = time.perf_counter()` + `started_at_iso = datetime.now(timezone.utc).isoformat()` BEFORE the `extractor.extract()` call (note: extract currently happens at the route level, not inside `ingest_document` — for `/reextract` and upload paths, the timing window needs to wrap the extractor invocation; Plan 02 picks where to place it).
2. After successful chunk insert, before the final `status='completed'` UPDATE, INSERT `pdf_extraction_runs` row using the supabase.table().insert() pattern (already used heavily in `ingest_document`):
   ```python
   # New insert — follows existing supabase.table(...).insert(...).execute() pattern at documents.py:702
   supabase.table("pdf_extraction_runs").insert({
       "document_id": document_id,
       "user_id": user_id,
       "engine": (engine_override or os.getenv("EXTRACTOR_PRIMARY", "docling")),
       "started_at": started_at_iso,
       "duration_ms": int((time.perf_counter() - extract_start) * 1000),
       "table_count": <captured at extract time>,
       "image_count": <captured at extract time>,
       "error": None,
   }).execute()
   ```
3. In the `except Exception` arm: insert a `pdf_extraction_runs` row with `error=str(e)[:1000]` and counts=0.

#### TODO comment for Phase 072 bbox-passthrough gap (RESEARCH.md Pitfall 4)

**Apply at `documents.py:711` and `:714` call sites** (per RESEARCH.md lines 619-636) — verbatim comment block:
```python
# TODO Phase 072 (RAG-MM-LIFT-01/02): extract_and_store_tables and
# extract_and_store_images currently re-extract from raw bytes via the
# multimodal_service helpers (Phase 069 D-069-04 single-pass contract).
# This means document_tables.bbox + document_images.bbox columns (migrations
# 041/042) stay NULL for new ingests even when engine='docling' produced rich
# bbox data on ExtractedDocument.tables[i].bbox. Phase 072 will refactor these
# helpers to accept the pre-extracted lists, at which point bbox flows through.
extract_and_store_tables(raw, mime_type, document_id, user_id, supabase)
```

---

### 15. `backend/app/models/user_settings.py` (MODIFIED — Plan 01, migration 044 reader hookup)

**Primary analog:** `user_settings.py:248-290` (`load_app_settings()` function — multi-line typed-reader pattern using `_int(override, key, env_val)` helper).

**Existing field-add pattern** (`user_settings.py:272-279`):
```python
# user_settings.py:272-279 — multi-line typed reader idiom
retrieval_top_k=_int(override, "retrieval_top_k", env_settings.retrieval_top_k),
retrieval_match_threshold=_float(override, "retrieval_match_threshold", env_settings.retrieval_match_threshold),
hybrid_search_enabled=_bool(override, "hybrid_search_enabled", env_settings.hybrid_search_enabled),
hybrid_candidate_count=_int(override, "hybrid_candidate_count", env_settings.hybrid_candidate_count),
vector_search_weight=_float(override, "vector_search_weight", env_settings.vector_search_weight),
keyword_search_weight=_float(override, "keyword_search_weight", env_settings.keyword_search_weight),
rrf_k=_int(override, "rrf_k", env_settings.rrf_k),
```

**Apply:** add two fields to the `UserEffectiveSettings` Pydantic model (around line 80, in the Retrieval section):
```python
# Multimodal limits (Phase 071 migration 044; Phase 072 actually uses these)
multimodal_max_vision_calls: int = 100
multimodal_max_b64_bytes_kb: int = 4096
```
…and two lines in `load_app_settings()` (matching the `_int(override, …)` shape):
```python
multimodal_max_vision_calls=_int(override, "multimodal_max_vision_calls", 100),
multimodal_max_b64_bytes_kb=_int(override, "multimodal_max_b64_bytes_kb", 4096),
```

**Note (RESEARCH.md Threat T-071-01-05):** the 5-second TTL cache at `user_settings.py:103-118` means settings reloads wait for cache expiry; documented expected behavior.

---

### 16. `backend/tests/integration/test_documents.py` (MODIFIED — Plan 04)

**Primary analog:** existing class structure at `test_documents.py:122-292` (`TestUploadDocument` — `client`, `auth_headers`, `mock_builder.execute.side_effect` pattern).

**Existing pattern** (`test_documents.py:137-150`):
```python
def test_valid_txt_upload_returns_201(self, client, auth_headers, mock_builder):
    # execute calls: 1=dedup check (no match), 2=stale check (no match), 3=insert
    mock_builder.execute.side_effect = [
        _make_result([]),         # dedup: no existing
        _make_result([]),         # stale: no stale
        _make_result([_doc_row()]),  # insert result
    ]

    with patch("app.api.documents.ingest_document"):
        response = client.post(
            "/documents/upload",
            headers=auth_headers,
            files={"file": ("test.txt", b"Hello world content", "text/plain")},
        )
```

**Existing helpers to reuse** (`test_documents.py:14-42`):
```python
USER_ID = "00000000-0000-0000-0000-000000000001"
DOC_ID = str(uuid4())
NOW = datetime.now(timezone.utc).isoformat()
FOLDER_ID = "00000000-0000-0000-0000-000000000099"

def _doc_row(doc_id=None, status="pending", folder_id=None):
    return {
        "id": doc_id or DOC_ID,
        "user_id": USER_ID,
        ...
        "mime_type": "text/plain",
        "status": status,
        ...
    }

def _make_result(data):
    r = MagicMock()
    r.data = data
    return r
```

**Apply — add `class TestReextractDocument`:**
1. `test_requires_auth` — copy `TestDeleteDocument.test_requires_auth:298-307` pattern verbatim, change verb to POST `/documents/{id}/reextract`.
2. `test_happy_path_returns_202` — `mock_builder.execute.side_effect` simulates select doc → delete chunks → delete tables → delete images → update doc → re-fetch — and `mock_builder` for `supabase.storage.from_("documents").download` returns synthetic bytes; `with patch("app.api.documents.ingest_document")` to assert it's called with `engine_override="docling"`.
3. `test_invalid_engine_returns_422` — FastAPI auto-422 on `Literal` mismatch; pattern from `TestUploadDocument.test_invalid_mime_type_returns_422:188-194`.
4. `test_unknown_doc_id_returns_404` — `mock_builder.execute.side_effect = [_make_result(None)]`; pattern from `TestDeleteDocument.test_returns_404_when_document_not_found:317-321`.

---

### 17. `backend/requirements.txt` (MODIFIED — Plan 03)

**Primary analog:** the existing Phase 070 D-070-14 multi-line comment block above the `supabase==2.29.0` pin.

**Existing pattern** (`requirements.txt:4-8`):
```text
# Pinned by Phase 070 (Q-v2.6-01 resolution): supabase 2.10 → 2.29.x closes the
# docling httpx<0.28 conflict. Bumping past supabase 2.29.x or relaxing the
# httpx<0.29 cap re-introduces the conflict. Re-run
# backend/tests/integration/test_pdf_extractor_docling_compat.py before changing.
supabase==2.29.0
```

**Apply (per D-PRD-07 Appendix + D-071-04):** insert a new multi-line comment block before a new `pymupdf>=1.24` line. Place between `pdfplumber>=0.11.0` (line 18) and `Pillow>=10.0.0` (line 19) — keeps PDF-extraction libs grouped. Suggested wording:
```text
# Added by Phase 071 (D-071-04, D-PRD-07 Appendix): PyMuPDF (AGPL-3.0).
# IMPORTANT — AGPL FENCE: `import fitz` is allowed ONLY in
# backend/extractors/pymupdf_isolated.py (child subprocess). Parent FastAPI
# process MUST NOT import fitz; enforced by
# backend/tests/integration/test_pymupdf_fence.py::test_fitz_not_imported_by_parent.
# Bumping or removing this pin requires re-verifying that test.
pymupdf>=1.24
```

**Do NOT touch** the Phase 070 D-070-14 lines (`supabase==2.29.0`, `httpx>=0.28.0,<0.29.0`, `docling>=2.93.0,<3.0.0`) — D-070-14 tripwire.

---

### 18. `backend/.env.example` (MODIFIED — Plan 02 + Plan 03)

**Primary analog:** existing section-header + sample-with-comment pattern at `backend/.env.example:12-21`.

**Existing pattern** (`backend/.env.example:12-21`):
```text
# ─────────────────────────────────────────────────────────────────────────────
# Supabase
# ─────────────────────────────────────────────────────────────────────────────
# Local (default — `supabase start` provides these):
#   SUPABASE_URL=http://127.0.0.1:54321
# Cloud:
#   SUPABASE_URL=https://<project-ref>.supabase.co

SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PROJECT_URL=http://127.0.0.1:54321
```

**Apply — append new section near the end** (per CONTEXT.md "New env vars"):
```text
# ─────────────────────────────────────────────────────────────────────────────
# PDF/DOCX extraction (Phase 071)
# ─────────────────────────────────────────────────────────────────────────────
# EXTRACTOR_PRIMARY: which engine new uploads use. Values: docling | pymupdf | legacy.
# Default 'docling' — layout-aware structured extraction (D-071-12).
# Use '/documents/{id}/reextract' to override per-document without flipping global.
EXTRACTOR_PRIMARY=docling

# PYMUPDF_TIMEOUT_S: subprocess timeout for the AGPL-fenced PyMuPDF child (D-071-03).
# On timeout, child is SIGKILL'd and caller raises ExtractionError.
PYMUPDF_TIMEOUT_S=60
```

**Do NOT add** `EXTRACTOR_DOCLING_ISOLATION` — rejected per Phase 070 D-070-15 (would document an unused knob; RESEARCH.md Anti-Patterns line 562).

---

### 19. `backend/README.md` (NEW — Plan 04 runbook line)

**Status:** `backend/README.md` does NOT currently exist (verified via Glob 2026-05-14). Root `README.md` exists. **Surface to user during plan-phase:** Plan 04 task should either (a) create a new `backend/README.md` with just the pre-pull line + a pointer back to top-level docs, or (b) append the line to the top-level `README.md`.

**Pre-pull one-liner** (CONTEXT.md Pre-pull / runbook surfaces line 229):
```bash
python -c "from docling.document_converter import DocumentConverter; DocumentConverter().convert('backend/tests/fixtures/extraction/reference.pdf')"
```

---

## Shared Patterns

### Authentication / Authorization (RLS)

**Source:** `backend/app/api/documents.py:436-446` (`/reingest` ownership check)
**Apply to:** new `POST /reextract` route, and any future per-document endpoint.

```python
doc = (
    supabase.table("documents")
    .select("*")
    .eq("id", document_id)
    .eq("user_id", current_user["id"])
    .eq("is_latest", True)
    .maybe_single()
    .execute()
)
if not doc.data:
    raise HTTPException(status_code=404, detail="Document not found")
```

**Critical:** 404 not 403 to avoid leaking existence (T-071-04-01).

### Error Handling

**Source:** `backend/app/services/extraction_service.py:104-122` (`LegacyExtractor.extract` try/except per-extraction-mode silent-swallow contract — D-069-04)
**Apply to:** `DoclingExtractor.extract` (Plan 02) and `PyMuPDFExtractor` parent wrapper (Plan 03).

Text failures raise (caller handles); tables/images failures are silently swallowed into `*_extraction_error` string fields.

**Source:** `backend/app/api/documents.py:724-729` (`ingest_document` top-level except)
**Apply to:** Docling failure policy per D-071-11 — fail loud, no auto-fallback. The existing `except Exception` arm sets `status='failed'`; Plan 02 layers a `pdf_extraction_runs` row INSERT inside the except.

### Lazy heavy imports (`# noqa: PLC0415` convention)

**Source:** `backend/app/services/extraction_service.py:134, 138, 148, 164` + `multimodal_service.py:42` + `documents.py:227`.
**Apply to:** all `docling.*` imports (inside `_get_converter()`), `tempfile` (inside `DoclingExtractor.extract()`), and any new `from app.services.extractors.* import ...` invocations inside route handlers.

### Module-level singleton / stateless extractor caching

**Source:** `backend/app/services/extraction_service.py:177` — `_LEGACY = LegacyExtractor()  # stateless — safe to share`
**Apply to:** `DoclingExtractor` (with double-checked-lock on the `_CONVERTER` global, not on the wrapper class — the class itself is stateless and constructible cheaply; only the heavy `DocumentConverter` needs the lock). `PyMuPDFExtractor` parent wrapper is also stateless — singleton is optional.

### `pdf_extraction_runs` RLS template

**Source:** `supabase/migrations/035_runs_table.sql:47-53`
**Apply to:** migration 039 — verbatim with renamed policy.

### Migration application discipline (CLAUDE.md MANDATORY)

**Apply to ALL six new migrations:**
1. Paste each `supabase/migrations/0{39..44}_*.sql` into the Supabase SQL editor manually.
2. After EACH migration, run `bash scripts/regenerate-full-schema.sh` (no-reset, live dump).
3. Commit migration file + regenerated `supabase/full-schema.sql` TOGETHER.
4. Never `supabase db push` / `supabase db reset` (verified by memory `feedback_apply_migrations_via_sql_editor.md`).
5. Verifier audit script (RESEARCH.md lines 796-806) greps the regenerated `full-schema.sql` for every new object after Plan 01 completes.

### BackgroundTasks scheduling

**Source:** `backend/app/api/documents.py:269-285` (upload) + `:481-490` (`/reingest`)
**Apply to:** new `/reextract` route — same `background_tasks.add_task(ingest_document, ...)` call shape. Plus an audit-log task per the existing pattern at `:279-285`.

### Pydantic-Literal body validation

**Source:** RESEARCH.md §Code Examples lines 1161-1163 (`ReextractRequest` model with `engine: Literal[...]`)
**Apply to:** `/reextract` body — FastAPI auto-422 on invalid value (T-071-04-02 mitigation).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `supabase/migrations/043_documents_dedup_unique_index.sql` (DELETE half) | migration / DELETE existing rows | destructive DML | No prior migration deletes existing rows. Treat as bespoke; RESEARCH.md §Runtime State Inventory line 594 requires Plan 01 dry-run + user-confirmation gate before applying. |
| `backend/README.md` runbook addition | docs | n/a | File doesn't exist yet; Plan 04 picks file (new `backend/README.md` vs append to root `README.md`). Surface to user during plan-phase. |
| `backend/extractors/__init__.py` | empty pkg marker | n/a | Trivial — no template needed beyond "empty file". |

---

## Metadata

**Analog search scope:**
- `backend/app/services/extraction_service.py` (Phase 069 ABC seam — 188 lines, read in full)
- `backend/app/api/documents.py` (read lines 1-80, 220-490, 634-729 — covers upload + `/reingest` + `ingest_document`)
- `backend/app/models/user_settings.py` (read in full — `load_app_settings` typed-reader pattern)
- `backend/app/services/multimodal_service.py` (referenced only — Phase 071 doesn't modify it; Pitfall 4 documents the seam)
- `backend/scripts/probe_multimodal.py:184-298` (Docling probe + tempfile pattern)
- `backend/tests/integration/test_pdf_extractor_docling_compat.py` (Phase 070 — read in full)
- `backend/tests/integration/test_documents.py` (lines 1-150, 234-330 — mock_builder + class pattern)
- `backend/tests/fixtures/extraction/_generate_fixtures.py` (existing reportlab + python-docx generator)
- `backend/requirements.txt` (read in full)
- `backend/.env.example` (lines 1-60)
- `supabase/migrations/035_runs_table.sql` (canonical RLS + partial index template — read in full)
- `supabase/migrations/037_messages_confidence_columns.sql` (ADD COLUMN IF NOT EXISTS idiom — read in full)
- `supabase/migrations/030_missing_tables.sql` (document_tables / document_images shape — read in full)
- `supabase/migrations/010_app_settings.sql` (`app_settings` table shape — read in full)
- `.planning/phases/071-docling-primary-path/071-CONTEXT.md` (read in full)
- `.planning/phases/071-docling-primary-path/071-RESEARCH.md` (read structurally + sections 301-560, 660-810, 942-1240)

**Files scanned:** 14 source files + 4 migrations + 2 phase artifacts = 20.
**Pattern extraction date:** 2026-05-14.
**Notes:**
- RESEARCH.md already contains full verbatim reference implementations for `DoclingExtractor`, `pymupdf_isolated.py`, the AGPL-fence test, and the `/reextract` route. Planner can lift these directly into PLAN.md task bodies.
- Every Docling adapter field has been verified live against Docling 2.93 / PyMuPDF 1.27 in `backend/venv` on 2026-05-14 (per RESEARCH.md line 664).
- The seam ambiguity at `extract_and_store_tables` / `extract_and_store_images` (RESEARCH.md Pitfall 4) is the one place Plan 02 needs an explicit `# TODO Phase 072` comment but no code change. Surface to user during plan-phase ONLY if Plan 02 task estimate balloons.
