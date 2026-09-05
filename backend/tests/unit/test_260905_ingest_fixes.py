"""BUG-260905-03…06 — four defects a Drive folder import surfaced that 5,600 tests did not.

Every one of them was found by DRIVING a real import and reading the resulting rows and logs, not
by reading code. They are grouped here because they share a cause: **the connector import door was
not the same door `/upload` uses**, and the differences between the two were invisible on screen.

  03  provenance destroyed on success  — `metadata` replaced wholesale at completion
  04  the durable queue bypassed       — no `ingestion_jobs` row for any connector import
  05  one PDF engine condemned a doc   — a pypdf bug failed files pymupdf reads fine
  06  storage keys refused, silently   — `[` in a filename → InvalidKey → empty error_message
"""

from __future__ import annotations

import pytest

from app.services.ingest_splice import _storage_safe


# ── BUG-260905-06 — the storage key ────────────────────────────────────────────────────────


class TestStorageSafeKey:
    """⚠ The failure was INVISIBLE: both upload sites swallow storage errors by design, so the
    document continued with no bytes stored and failed later with an EMPTY error_message."""

    def test_square_brackets_are_replaced(self):
        # The exact filename that produced a real 400 InvalidKey from Supabase Storage.
        got = _storage_safe("Cambridge IELTS 14 with Answers GT [www.luckyielts.com].pdf")
        assert "[" not in got and "]" not in got
        assert got == "Cambridge IELTS 14 with Answers GT _www.luckyielts.com_.pdf"

    @pytest.mark.parametrize("ch", list('[]{}#%^`"\'<>|\\?*'))
    def test_every_declared_unsafe_character_is_removed(self, ch):
        assert ch not in _storage_safe(f"a{ch}b.pdf")

    def test_ordinary_names_are_untouched(self):
        # A sanitiser that mangles normal filenames is worse than the bug it fixes.
        for name in ["report.pdf", "normal file.pdf", "Ünïcodé näme.docx", "a-b_c.1.txt"]:
            assert _storage_safe(name) == name

    def test_runs_of_replacement_collapse(self):
        assert _storage_safe("a[b]c__d.docx") == "a_b_c_d.docx"

    def test_an_empty_or_blank_name_still_yields_a_key(self):
        # A key of "" would make the path end in a slash and 400 for a different reason.
        assert _storage_safe("") == "file"
        assert _storage_safe("   ") == "file"

    def test_path_separators_are_not_in_the_unsafe_set_by_accident(self):
        # `/` MUST survive — it is the key's own directory separator, and the caller builds
        # `{user}/{doc}/{name}` around this function. Sanitising it would flatten the path.
        assert _storage_safe("a/b.pdf") == "a/b.pdf"


# ── BUG-260905-05 — one engine must not condemn a document ─────────────────────────────────


class TestTextEngineFallback:
    """Measured, not hypothesised: three real PDFs failed with `IndexError` from inside pypdf
    (`_cmap.py:427`, a malformed `/W` font-width array) and read cleanly with pymupdf —
    50775 / 49128 / 48308 chars."""

    def _run(self, monkeypatch, engines: dict, mime="application/pdf"):
        from app.services import extraction_service
        from app.services.extractors import aspects

        monkeypatch.setattr(aspects, "TEXT_ENGINES", engines, raising=False)
        monkeypatch.setattr(
            extraction_service, "load_app_settings",
            lambda: type("S", (), {
                "extraction_text_engine_pdf": "legacy",
                "extraction_text_engine_docx": "legacy",
                "extraction_table_engine_pdf": "camelot",
                "extraction_image_engine_pdf": "none",
                "extraction_image_engine_docx": "none",
                "extraction_equation_engine": "none",
            })(),
        )
        monkeypatch.setattr(aspects, "TABLE_ENGINES", {"camelot": lambda *a: []}, raising=False)
        monkeypatch.setattr(aspects, "IMAGE_ENGINES_PDF", {"none": lambda *a: []}, raising=False)
        monkeypatch.setattr(aspects, "IMAGE_ENGINES_DOCX", {"none": lambda *a: []}, raising=False)
        monkeypatch.setattr(aspects, "EQUATION_ENGINES", {"none": lambda *a: []}, raising=False)
        return extraction_service.extract_composable(b"%PDF-fake", mime, None)

    def test_the_configured_engine_is_tried_first(self, monkeypatch):
        order = []
        out = self._run(monkeypatch, {
            "legacy": lambda r, m: (order.append("legacy"), ("from legacy", None))[1],
            "pymupdf": lambda r, m: (order.append("pymupdf"), ("from pymupdf", None))[1],
        })
        # ⛔ The operator's engine choice is a SETTING with quality consequences, not a hint.
        #    A fallback that silently reordered would make that setting unobservable.
        assert order == ["legacy"]
        assert out.text == "from legacy"

    def test_a_failing_engine_falls_through_to_a_working_one(self, monkeypatch):
        def boom(r, m):
            raise IndexError("list index out of range")

        out = self._run(monkeypatch, {"legacy": boom, "pymupdf": lambda r, m: ("recovered", None)})
        assert out.text == "recovered"

    def test_the_lineage_names_the_engine_that_ACTUALLY_read_the_bytes(self, monkeypatch):
        # ⭐ A fallback nobody can see in the extractor column is a fallback nobody can audit.
        def boom(r, m):
            raise IndexError("list index out of range")

        out = self._run(monkeypatch, {"legacy": boom, "pymupdf": lambda r, m: ("recovered", None)})
        assert "pymupdf" in (out.extractor_name or "")
        assert "legacy" not in (out.extractor_name or "")

    def test_when_EVERY_engine_fails_it_still_raises(self, monkeypatch):
        # D-069-04 is unchanged: a text failure is fatal where a table failure is swallowed.
        def boom_a(r, m):
            raise IndexError("list index out of range")

        def boom_b(r, m):
            raise ValueError("not a pdf")

        with pytest.raises(Exception) as ei:
            self._run(monkeypatch, {"legacy": boom_a, "pymupdf": boom_b})
        # …and the message names each attempt, so "unreadable" is a claim with evidence.
        msg = str(ei.value)
        assert "legacy" in msg and "pymupdf" in msg
        assert "IndexError" in msg and "ValueError" in msg


# ── BUG-260905-03 — provenance survives extraction ─────────────────────────────────────────


class TestProvenanceSurvivesReExtraction:
    """⚠ MEASURED ON REAL ROWS: after a Drive import, only the FAILED documents still carried
    `metadata.source` — because only they never reached the completion write. The "Already here"
    bucket would have matched nothing, forever."""

    def test_the_source_key_is_carried_forward_from_the_prior_metadata(self):
        # The guard, in the shape documents.py applies it.
        prior_meta = {"source": {"system": "google", "external_id": "abc", "version": "v1"}}
        metadata_dict = {"title": "Extracted Title", "document_type": "report"}

        for pk in ("source",):
            if pk in prior_meta:
                metadata_dict = metadata_dict or {}
                metadata_dict.setdefault(pk, prior_meta[pk])

        assert metadata_dict["source"]["external_id"] == "abc"
        assert metadata_dict["title"] == "Extracted Title"  # extraction still wins its own keys

    def test_a_fresh_source_value_is_not_overwritten_by_the_prior_one(self):
        # `setdefault`, not assignment: if a caller ever supplies a newer identity, it stands.
        prior_meta = {"source": {"version": "old"}}
        metadata_dict = {"source": {"version": "new"}}
        for pk in ("source",):
            if pk in prior_meta:
                metadata_dict.setdefault(pk, prior_meta[pk])
        assert metadata_dict["source"]["version"] == "new"

    def test_the_real_guard_is_present_at_the_single_write_site(self):
        # A fence over the source, so the guard cannot be moved out of the one function all
        # three re-extract entry points funnel through (/upload, /reingest, /reextract).
        import pathlib

        src = pathlib.Path("app/api/documents.py").read_text(encoding="utf-8")
        assert "_PROVENANCE_KEYS" in src
        i_guard = src.index("_PROVENANCE_KEYS")
        # ⚠ `rindex`, not `index`: the guard's OWN comment quotes the write it protects, and
        #    matching that comment would compare a line against itself and pass vacuously.
        i_write = src.rindex('"metadata": metadata_dict,')
        assert i_guard < i_write, "the provenance carry must run BEFORE the metadata write"


# ── BUG-260905-04 — the connector import uses the durable queue ────────────────────────────


class TestConnectorImportUsesTheQueue:
    def test_the_import_service_enqueues_rather_than_splicing_directly(self):
        import pathlib

        src = pathlib.Path("app/services/sources/import_service.py").read_text(encoding="utf-8")
        assert "insert_ingestion_job" in src, "the connector door must enqueue like /upload"
        # ⚠ The direct splice survives ONLY as the never-strand fallback, and it must stay
        #   inside the helper rather than being the main path again.
        assert "_enqueue_or_splice" in src
        i_helper = src.index("async def _enqueue_or_splice")
        i_import = src.index("async def import_single_file")
        # ⚠ Count CALLS, not mentions: the helper's docstring names the old idiom in order to
        #    explain why it is no longer the main path, and a naive `count` matches that too.
        calls = [ln for ln in src.splitlines() if ln.strip().startswith("background_tasks.add_task(")]
        assert len(calls) == 1, (
            f"exactly one direct-splice call should remain (the fallback); found {len(calls)}"
        )
        assert i_helper < i_import

    def test_bytes_reach_storage_before_the_job_exists(self):
        # The worker calls splice_document with no `raw` and downloads from file_path. Enqueue
        # without uploading and it gets b"" and fails with a message that blames the FILE.
        import pathlib

        src = pathlib.Path("app/services/sources/import_service.py").read_text(encoding="utf-8")
        i_upload = src.index(".upload(")
        i_enqueue = src.index("insert_ingestion_job(")
        assert i_upload < i_enqueue, "the upload must precede the enqueue"
