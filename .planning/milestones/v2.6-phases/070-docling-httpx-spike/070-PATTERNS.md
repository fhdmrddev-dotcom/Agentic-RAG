# Phase 070: Docling httpx Spike — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 4 (1 new test, 1 requirements bump, 1 PROJECT.md row, 1 SUMMARY markdown)
**Analogs found:** 4 / 4 (all strong matches)

## Phase shape (recap from CONTEXT.md)

This is a **2-plan dependency-resolution spike** — no new ABC, no extractor class, no migrations, no frontend. The work is:

1. Bump `supabase==2.10.0` → `supabase==2.29.x` in `backend/requirements.txt` (path (a), per D-070-05/06 attempt order a→c→b).
2. Sweep `from gotrue` → `from supabase_auth` and `from supafunc` → `from supabase_functions` in `backend/` (path (a) only). **Discovered:** zero hits in `backend/**/*.py` today — the sweep is a verification step, not a rewrite step. Three matches exist but all live in scratch `_broader-*.txt` files (not source).
3. Write `backend/tests/integration/test_pdf_extractor_docling_compat.py` (two test fns).
4. Run the full backend pytest suite.
5. Append a Q-v2.6-01 closure row to `.planning/PROJECT.md` Key Decisions.
6. Author `070-SUMMARY.md` with `## Rejected Paths` matrix (D-070-04/13).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/tests/integration/test_pdf_extractor_docling_compat.py` (NEW) | integration-test | request-response (sync) | `backend/scripts/probe_multimodal.py::probe_docling` + `backend/tests/integration/test_documents.py` + `backend/tests/integration/test_health.py` | exact (composite) |
| `backend/requirements.txt` (MODIFY) | config (pip pinfile) | static-manifest | self (existing `# Phase 069 test fixtures` comment at line 24) | exact (in-file precedent) |
| `.planning/PROJECT.md` Key Decisions row (MODIFY) | planning-doc | document-section | `D-v2.5-08` / `D-v2.5-11` / `D-v2.5-12` rows (PROJECT.md lines 289-293) | exact |
| `.planning/phases/070-docling-httpx-spike/070-SUMMARY.md` (NEW) | planning-doc | document-section | `.planning/seeds/SEED-006-multimodal-extraction-quality.md` §Docling Evaluation (lines 79-92) | role-match (source text) |

**No source code analog** for the `gotrue`/`supafunc` import-rename sweep — verified empty in `backend/**/*.py`. Treat as a "scan + report" task, not a refactor.

---

## Pattern Assignments

### `backend/tests/integration/test_pdf_extractor_docling_compat.py` (NEW)

This file is a composite of three analogs. The Docling invocation comes from `probe_multimodal.py`; the pytest shape comes from `test_health.py` (the simplest existing integration test); the real-supabase-client landmine is informed by `backend/tests/conftest.py` (which **mocks** supabase for all tests in this folder today — see Landmine #2 below).

#### Analog A: `backend/scripts/probe_multimodal.py::probe_docling` (lines 187-221)

**The exact Docling import + convert pattern** the spike test must replicate:

```python
# Inside probe_docling() — probe_multimodal.py:189-203
try:
    from docling.document_converter import DocumentConverter
except ImportError as e:
    r.error = f"not installed (`pip install docling`): {e}"
    return r
r.available = True
try:
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=os.path.splitext(filename)[1] or ".pdf", delete=False) as tf:
        tf.write(raw)
        tmp_path = tf.name
    try:
        converter = DocumentConverter()
        result = converter.convert(tmp_path)
        doc = result.document
        ...
```

**What to copy verbatim:**
- `from docling.document_converter import DocumentConverter`
- `converter = DocumentConverter(); result = converter.convert(<path>)`
- `result.document` is the accessor for the converted artifact

**What to change:**
- The spike test reads the committed `backend/tests/fixtures/extraction/reference.pdf` directly — no tempfile dance needed (the fixture is already on disk).
- Spike asserts via `result.document.export_to_markdown()` length > 0 (per D-070-01) instead of counting tables/images.
- **Move the import to module top.** `probe_multimodal.py` does lazy imports inside function bodies because it's a diagnostic that gracefully handles `docling` not being installed. The spike test is the *opposite* — it must fail loudly if docling isn't importable, so put `from docling.document_converter import DocumentConverter` at the top of the file. This divergence is intentional.

#### Analog B: `backend/tests/integration/test_health.py` (lines 1-22)

**The minimal-surface pytest shape** for a sync integration test:

```python
"""Integration tests for public system endpoints: /health and /models."""


class TestHealth:
    def test_health_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_returns_ok_status(self, client):
        """Phase 061 SC#6: /health body is {status, redis} — was {status} pre-061."""
        response = client.get("/health")
        body = response.json()
        assert body["status"] == "ok"
```

**What to copy:**
- One-line module docstring describing scope.
- Plain `def test_*` functions (sync, not async). The spike's smoke calls are synchronous supabase-py calls — `pytest.ini` has `asyncio_mode = auto` but sync `def` is fine and pytest-friendly.
- No `@pytest.mark.integration` decorator. **Verified absent** — `backend/pytest.ini` has only `asyncio_mode` and `testpaths`; no `markers` section, and `grep '@pytest.mark.integration'` over `backend/**/*.py` returns zero hits. Folder placement at `backend/tests/integration/` is the only marker (D-070-10).

#### Analog C: `backend/tests/conftest.py` (lines 22-81)

**Fixture-injected supabase Client + mock pattern** — and a **landmine**.

The existing conftest *mocks* supabase via `app.dependency_overrides[get_supabase] = lambda: _supabase` (conftest.py:81) and resets the mock in an `autouse=True` fixture (conftest.py:86-134). **The spike's `test_supabase_smoke_post_resolution` cannot use this mock** — a mock would pass even if the supabase library itself crashed on import or client construction. That defeats the entire point of D-070-02.

**What to do (Claude's-discretion choice from CONTEXT.md):**

Either:
1. **Inline real client construction** inside the test function — bypasses the autouse mock by not using `client`/`mock_builder` fixtures at all:
   ```python
   from supabase import create_client
   from app.config import settings  # or os.environ

   def test_supabase_smoke_post_resolution():
       sb = create_client(settings.supabase_url, settings.supabase_service_role_key)
       resp = sb.table("documents").select("id").limit(1).execute()
       assert hasattr(resp, "data")  # smoke — proves client constructs and roundtrips
       storage_list = sb.storage.from_("documents").list("", {"limit": 1})
       assert isinstance(storage_list, list)
   ```
2. **Local `@pytest.fixture`** for a real client — same call, just hoisted. CONTEXT.md `<decisions>` § Claude's Discretion allows either.

Pattern source for `create_client` invocation: `backend/app/dependencies.py:16`:
```python
_supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
```

#### Analog D: `backend/scripts/probe_multimodal.py::load_from_supabase` (lines 228-242)

**Storage SDK invocation pattern** for the second smoke assertion (D-070-12):

```python
# probe_multimodal.py:241
raw = sb.storage.from_("documents").download(file_path)
```

For the spike, mutate this to a non-destructive list:
```python
sb.storage.from_("documents").list("", {"limit": 1})  # D-070-07 / D-070-12
```

#### Pitfalls / Landmines (CRITICAL)

1. **Lazy import divergence.** `probe_multimodal.py` lazy-imports `docling`, `fitz`, `pdfplumber` inside function bodies (script-line 42, 116, 190) so the diagnostic doesn't crash when a library is uninstalled. The spike test does the opposite — top-level `from docling.document_converter import DocumentConverter` so a missing/broken docling install fails the test with a clear ImportError at collection time. This is the load-bearing assertion for D-070-01.

2. **Autouse mock in conftest.py.** `backend/tests/conftest.py:86-134` is an `autouse=True` fixture that overrides `get_supabase` with a `MagicMock` for **every test in `backend/tests/`**. The spike smoke test needs to either (a) instantiate `create_client(...)` directly inside the test body, or (b) explicitly pop the override (`app.dependency_overrides.pop(get_supabase, None)`) before constructing a real client. Plain reliance on the `client` TestClient fixture will silently return mocked data and the smoke will be meaningless.

3. **`asyncio_mode = auto`** in `pytest.ini` means async test fns auto-get an event loop — but the spike calls are sync. Using plain `def test_*` is correct; do not add `async`.

4. **Docling ~600 MB first-run model download** (D-070-09). The test will be slow the first run. No `@pytest.mark.slow` exists in this project (verified), and D-070-09 explicitly says don't add a skip-gate. Just accept the first-run cost and let CI cache `~/.cache/docling`.

5. **Real DB roundtrip** requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set to a real instance, not the conftest defaults (`https://test.supabase.co`, `test-service-role-key` — conftest.py:10-11). The spike test must either read the real values from `backend/.env` (where they live per CLAUDE.md "Local dev infrastructure") or skip if not set. Recommended: `pytest.skip("real Supabase not configured")` when `SUPABASE_URL` starts with `https://test.` — keeps the test green in CI environments that don't have a dev Supabase wired up.

6. **Fixture path.** The committed reference fixture is at `backend/tests/fixtures/extraction/reference.pdf` (verified — sibling files: `reference.docx`, `reference_pdf_golden.json`, `_generate_fixtures.py`). Resolve relative to `__file__`, not CWD: `Path(__file__).parent.parent / "fixtures" / "extraction" / "reference.pdf"`.

---

### `backend/requirements.txt` (MODIFY)

**Analog:** self — line 24 `reportlab>=4.0.0  # Phase 069 test fixtures (PDF synth for golden-extraction tests)`

**Current state** (verified):
```
1   fastapi==0.115.6
2   sse-starlette==2.4.1
3   uvicorn[standard]==0.32.1
4   supabase==2.10.0
...
23  httpx>=0.27.0
24  reportlab>=4.0.0  # Phase 069 test fixtures (PDF synth for golden-extraction tests)
```

**Comment style to match** (D-070-14 — "match the existing style of comments in that file"):

The existing in-file precedent is a **trailing single-line comment** on the same line as the pin, prefixed `# Phase NNN <reason>`. The D-070-14 guardrail asks for a comment block *above* the pinned lines. Both forms are acceptable per CONTEXT.md Claude's Discretion. Recommended hybrid:

```text
# Phase 070 (Q-v2.6-01 resolution): supabase 2.10 → 2.29 closes the docling httpx<0.28 conflict.
# Bumping past supabase 2.29.x re-introduces the conflict.
# Re-run backend/tests/integration/test_pdf_extractor_docling_compat.py before changing.
supabase==2.29.x  # ← pin to the actual latest 2.29.x at spike time
...
httpx>=0.28.0,<0.29.0  # Phase 070: bounds widened to satisfy docling>=2.x
...
docling>=2.x  # Phase 070: layout-aware extractor (RAG-DOCLING-01); ~600 MB model first-run download
```

**Pitfall:** Don't pin `docling` until path (a) is confirmed green (per CONTEXT.md `<specifics>` bullet 7). If path (c) wins, docling moves to a separate `requirements-extractor-subprocess.txt`. Plan 1's resolution-apply step is when the pin lands.

---

### `.planning/PROJECT.md` Key Decisions row (MODIFY — Plan 2)

**Analog:** `.planning/PROJECT.md` lines 289-293 (D-v2.5-08 through D-v2.5-12).

**Format observed** (3-column markdown table, bold decision-id, full sentence rationale, "✓ Good" or "New —" outcome):

```markdown
| **D-v2.5-08**: Run-backed streaming via Redis Streams (not pgmq, not LISTEN/NOTIFY) | Redis Streams provide native replay-from-offset + live-tail (`XREAD` with cursor), trivial multi-consumer fan-out (each tab is an independent reader), one-line per-key TTL, and battle-tested for chat-streaming infra at scale. pgmq is a queue (consume-once) which fights the use case; LISTEN/NOTIFY hits 8KB payload limits and requires a separate events table for replay. Free Upstash tier covers this app's scale; Redis is a one-line add when deploying to Hostinger (SEED-003). | New — locked 2026-05-02 by user before /gsd:discuss-phase 061 |
```

**Row to add** (per CONTEXT.md `<specifics>` bullet 8 — format `D-v2.6-01: Q-v2.6-01 resolution: <chosen path>`):

```markdown
| **D-v2.6-01**: Q-v2.6-01 resolution — <path (a|b|c) chosen> | <one-paragraph rationale citing rejected paths and pointing at 070-SUMMARY.md matrix> | New — green at Phase 070 (<date>); test gate `backend/tests/integration/test_pdf_extractor_docling_compat.py` |
```

**Pitfall:** Append to the existing table, do **not** start a new section. Match the bold `**D-NN-NN**:` prefix and the trailing-cell "New — ..." status pattern.

---

### `.planning/phases/070-docling-httpx-spike/070-SUMMARY.md` (NEW — Plan 2)

**Analog:** `.planning/seeds/SEED-006-multimodal-extraction-quality.md` §Docling Evaluation (lines 79-92).

The seed already documents (i) the httpx conflict, (ii) the package renames `gotrue→supabase-auth` / `supafunc→supabase-functions`, and (iii) the ~600 MB download. **Quote this section verbatim** as the historical-rationale framing in `070-SUMMARY.md`, then attach the empirical results.

**Matrix structure required by D-070-04 / D-070-13:**

```markdown
## Rejected Paths

### Path (b) — Pin docling back to an httpx<0.28-compatible version
- **Pip command attempted:** `pip index versions docling` (one-shot PyPI lookup)
- **Output:** <verbatim PyPI version listing>
- **Wall-clock:** ~30s
- **Rationale:** No docling version published with `httpx<0.28` constraint. Falsified cheaply via PyPI lookup; no install attempted. Marked **not empirically attempted**.

### Path (c) — Subprocess isolation
- **Pip command attempted:** (none — pro-forma rejection per D-070-05)
- **Output:** N/A
- **Wall-clock:** 0 (not attempted)
- **Rationale:** Path (a) succeeded; subprocess overhead (process spawn + JSON/pickle IPC per extract) unjustified once in-process coexistence works. PyMuPDF subprocess-fence precedent (D-PRD-07 Appendix, Phase 069 Plan 02) remains available if path (a) regresses in future. Marked **not empirically attempted**.
```

Five fields per entry (D-070-04): (i) path id, (ii) verbatim pip commands, (iii) verbatim error output, (iv) wall-clock, (v) rationale.

---

## Shared Patterns

### Sync-to-async wrapping (CLAUDE.md rule, D-v2.5-01)
**Source:** `CLAUDE.md` line 25: *"Do not run blocking I/O directly inside async handlers — wrap with `run_in_threadpool`"*
**Apply to:** No spike change needed. The spike test functions are plain sync `def test_*` — they don't run inside async handlers. The full-suite pytest run (Plan 1 step) is the only place `run_in_threadpool` paths get exercised, via existing `test_threads_*.py` and `test_06*_*.py` integration tests. If those go red post-upgrade, the supabase 2.29.x upgrade has broken the threadpool path — that's the signal D-070-12 names.

### venv mandatory (CLAUDE.md rule)
**Source:** `CLAUDE.md` line 16: *"Python backend must use a venv virtual environment"*
**Apply to:** All pip commands in Plan 1. Activate `backend/venv` before `pip install`; document the venv-bound install in 070-SUMMARY.md (CONTEXT.md `<specifics>` bullet 6 — "the spike test's supabase smoke only proves anything if it runs against the same dependency tree the rest of the backend uses").

### Single uvicorn worker (D-v2.5-02, still in force)
**Source:** `CLAUDE.md` line 26.
**Apply to:** No spike change. Multi-worker supersession is Phase 079, not 070.

### Read-only files (D-070-15 non-regression target)
- `backend/app/services/extraction_service.py` — Phase 069's `PdfExtractor` ABC + `LegacyExtractor` + `get_extractor(mime)` dispatcher. Do not touch. Phase 071 owns the `DoclingExtractor` plug-in.
- `backend/app/api/documents.py:126-289` — upload endpoint + `background_tasks.add_task(ingest_document, ...)` at line 269. Verified: the `BackgroundTasks` HTTP-decoupling flow is intact. Do not modify. The supabase 2.10 → 2.29 upgrade (path a) should be transparent here; the full-suite pytest run is the regression gate (D-070-11 #3).
- `frontend/**` — out of scope per D-070-03.
- `supabase/migrations/**` — zero migrations this phase (CONTEXT.md `<canonical_refs>` § "No DB changes").

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `from gotrue` / `from supafunc` rename sweep across `backend/**/*.py` | refactor task | n/a | **No source-code matches exist today.** Verified via `Grep("from gotrue\|from supafunc")` across `backend/` (excluding `venv/`): three matches, all in scratch `_broader-*.txt` files at `backend/` root, not in any `.py` source. Plan 1's sweep step is a verification-only task (run the grep, confirm zero `.py` hits, document in plan output) — there is no code to rewrite. If `supabase 2.29.x` adds a transitive that imports `gotrue` at runtime, that surfaces as a pytest failure in Plan 1 step 3 (full-suite), not as a static sweep miss. |

---

## Quick reference — line/path index

| Asset | Path | Lines |
|-------|------|-------|
| Docling import + convert | `backend/scripts/probe_multimodal.py` | 187-221 |
| Storage SDK invocation pattern | `backend/scripts/probe_multimodal.py` | 228-242 |
| Sync integration-test shape | `backend/tests/integration/test_health.py` | 1-49 |
| Pytest autouse-mock landmine | `backend/tests/conftest.py` | 22-134 |
| `create_client` invocation | `backend/app/dependencies.py` | 16 |
| Existing requirements.txt comment style | `backend/requirements.txt` | 24 |
| Pre-upgrade pins to bump | `backend/requirements.txt` | 4, 23 |
| Reference PDF fixture (~3.3 KB) | `backend/tests/fixtures/extraction/reference.pdf` | n/a |
| Pytest config (no `[markers]`) | `backend/pytest.ini` | 1-4 |
| PROJECT.md Key Decisions analog rows | `.planning/PROJECT.md` | 289-293 |
| SEED-006 Docling rationale (matrix source text) | `.planning/seeds/SEED-006-multimodal-extraction-quality.md` | 79-92 |
| Upload + BackgroundTasks (D-070-15 non-regression target) | `backend/app/api/documents.py` | 126-289 |
| Phase 069 ABC + dispatcher (read-only) | `backend/app/services/extraction_service.py` | full file |

## Metadata

**Analog search scope:** `backend/scripts/`, `backend/tests/`, `backend/app/`, `backend/requirements.txt`, `backend/pytest.ini`, `.planning/PROJECT.md`, `.planning/seeds/`
**Files scanned:** 13 (3 primary analogs read in full or targeted-range; remainder via Glob/Grep for verification)
**Pattern extraction date:** 2026-05-14
