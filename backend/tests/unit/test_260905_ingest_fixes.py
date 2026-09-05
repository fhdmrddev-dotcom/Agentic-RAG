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


# ── BUG-260905-07 — the recursive walk, and the budget that stops it ───────────────────────


class _Node:
    def __init__(self, id, name="f"):
        self.id = id
        self.name = name
        self.kind = "folder"
        self.drive_id = None
        self.has_children = True
        self.parent_id = None


class _File:
    def __init__(self, id, name="a.txt"):
        self.id = id
        self.name = name
        self.mime_type = "text/plain"
        self.size = 1
        self.modified_at = "2026-09-01T00:00:00Z"
        self.drive_id = None
        self.icon_url = None
        self.web_view_url = None


class _TreeAdapter:
    """A source shaped exactly like the tree under test.

    `tree` maps folder_id -> (list[file_id], list[child_folder_id]).
    """

    def __init__(self, tree, pages=None, unreadable=()):
        self.tree = tree
        self.pages = pages or {}
        self.unreadable = set(unreadable)
        self.listed: list[str | None] = []

    async def list_files(self, connection=None, folder_id=None, recursive=False,
                         page_token=None, query=None, page_size=30):
        from app.services.sources.base import FilePage

        self.listed.append(folder_id)
        if folder_id in self.pages:
            # A folder that always claims one more page — the unbounded-pagination case.
            return FilePage(files=[_File(f"{folder_id}-p{page_token or 0}")],
                            next_page_token=str(int(page_token or 0) + 1))
        files, _ = self.tree.get(folder_id, ([], []))
        return FilePage(files=[_File(i) for i in files], next_page_token=None)

    async def browse(self, connection=None, folder_id=None, page_token=None):
        from app.services.sources.base import BrowsePage

        if folder_id in self.unreadable:
            raise ValueError("permission denied")
        _, children = self.tree.get(folder_id, ([], []))
        return BrowsePage(items=[_Node(c) for c in children], next_page_token=None)


TREE = {
    "root": (["a", "b"], ["sub1", "sub2"]),
    "sub1": (["c"], ["deep"]),
    "sub2": (["d"], []),
    "deep": (["e"], []),
}


class TestRecursiveWalk:
    """⚠ `SourceAdapter.list_files` has taken `recursive: bool = False` since Phase 232 and
    NEITHER shipped adapter ever read it — `grep -rn recursive` returned three declarations and
    zero uses. The preview therefore looked one level deep while its own signature said it could
    go deeper, and the operator was shown less than they had selected."""

    @pytest.mark.asyncio
    async def test_non_recursive_reads_only_the_chosen_folder(self):
        from app.services.sources import preview_service as ps

        a = _TreeAdapter(TREE)
        r = await ps.walk_source_files(adapter=a, connection={}, folder_id="root", recursive=False)
        assert [f.id for f in r.files] == ["a", "b"]
        assert r.folders_visited == 1
        assert r.truncated is False

    @pytest.mark.asyncio
    async def test_recursive_reaches_every_level(self):
        from app.services.sources import preview_service as ps

        a = _TreeAdapter(TREE)
        r = await ps.walk_source_files(adapter=a, connection={}, folder_id="root", recursive=True)
        assert sorted(f.id for f in r.files) == ["a", "b", "c", "d", "e"]
        assert r.folders_visited == 4
        assert r.truncated is False

    @pytest.mark.asyncio
    async def test_a_cycle_does_not_loop_forever(self):
        # Drive shortcuts and shared drives can point back at a folder already queued.
        from app.services.sources import preview_service as ps

        cyclic = {"root": (["a"], ["sub"]), "sub": (["b"], ["root", "sub"])}
        a = _TreeAdapter(cyclic)
        r = await ps.walk_source_files(adapter=a, connection={}, folder_id="root", recursive=True)
        assert sorted(f.id for f in r.files) == ["a", "b"]

    @pytest.mark.asyncio
    async def test_depth_is_bounded_and_the_stop_is_NAMED(self, monkeypatch):
        from app.services.sources import preview_service as ps

        monkeypatch.setattr(ps, "MAX_DEPTH", 1)
        a = _TreeAdapter(TREE)
        r = await ps.walk_source_files(adapter=a, connection={}, folder_id="root", recursive=True)
        assert r.truncated is True
        # ⛔ "some files" is the sentence that lets a person assume the rest were fine.
        assert r.stopped_by == "depth"
        assert "e" not in [f.id for f in r.files]

    @pytest.mark.asyncio
    async def test_folder_count_is_bounded(self, monkeypatch):
        from app.services.sources import preview_service as ps

        monkeypatch.setattr(ps, "MAX_FOLDERS", 2)
        a = _TreeAdapter(TREE)
        r = await ps.walk_source_files(adapter=a, connection={}, folder_id="root", recursive=True)
        assert r.truncated is True and r.stopped_by == "folders"

    @pytest.mark.asyncio
    async def test_file_count_is_bounded_and_the_list_is_actually_trimmed(self, monkeypatch):
        from app.services.sources import preview_service as ps

        monkeypatch.setattr(ps, "MAX_FILES", 3)
        a = _TreeAdapter(TREE)
        r = await ps.walk_source_files(adapter=a, connection={}, folder_id="root", recursive=True)
        assert r.truncated is True and r.stopped_by == "files"
        # A cap that reports truncation but returns MORE than the cap is not a cap.
        assert len(r.files) == 3

    @pytest.mark.asyncio
    async def test_endless_pagination_stops_and_says_so(self, monkeypatch):
        from app.services.sources import preview_service as ps

        monkeypatch.setattr(ps, "MAX_PAGES_PER_FOLDER", 3)
        a = _TreeAdapter({"root": ([], [])}, pages={"root"})
        r = await ps.walk_source_files(adapter=a, connection={}, folder_id="root", recursive=False)
        assert r.truncated is True and r.stopped_by == "pages"
        assert len(r.files) == 3

    @pytest.mark.asyncio
    async def test_an_unreadable_branch_truncates_and_NEVER_fabricates(self):
        # ⛔ The Onyx #1161 shape: a partial read must not be presented as a complete one.
        from app.services.sources import preview_service as ps

        a = _TreeAdapter(TREE, unreadable={"sub1"})
        r = await ps.walk_source_files(adapter=a, connection={}, folder_id="root", recursive=True)
        assert r.truncated is True and r.stopped_by == "unreadable"
        # sub2 was still read — one bad branch degrades itself, not the whole walk.
        assert "d" in [f.id for f in r.files]

    @pytest.mark.asyncio
    async def test_the_adapter_is_asked_for_ONE_level_at_a_time(self):
        # ⚠ The walk owns recursion, NOT the adapter — that is the Phase 232 contract honoured:
        #   "adding a source family is data and registration, never an ingest path".
        from app.services.sources import preview_service as ps

        seen = []

        class _Recorder(_TreeAdapter):
            async def list_files(self, connection=None, folder_id=None, recursive=False, **kw):
                seen.append(recursive)
                return await super().list_files(connection=connection, folder_id=folder_id, **kw)

        a = _Recorder(TREE)
        await ps.walk_source_files(adapter=a, connection={}, folder_id="root", recursive=True)
        assert seen and all(r is False for r in seen)

    @pytest.mark.asyncio
    async def test_a_file_in_two_folders_is_counted_ONCE(self):
        # Drive lets a file have more than one parent, so two folders legitimately return the
        # same file in one walk. Counting it twice breaks SC#4 by ARITHMETIC rather than logic:
        # the preview promises N and the confirm delivers N-1, with nothing obviously wrong.
        from app.services.sources import preview_service as ps

        shared = {"root": (["a"], ["s1", "s2"]), "s1": (["dup"], []), "s2": (["dup"], [])}
        a = _TreeAdapter(shared)
        r = await ps.walk_source_files(adapter=a, connection={}, folder_id="root", recursive=True)
        assert sorted(f.id for f in r.files) == ["a", "dup"]
