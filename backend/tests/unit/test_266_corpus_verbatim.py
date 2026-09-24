"""Phase 266 (PACK-18 / D-266-05) — the Financial Analyzer's corpus ships as DATA in the repo.

What this file pins, and why each pin exists:

1. VERBATIM. The corpus bytes equal migration 188's `full_markdown` literal. The literal is
   extracted from the migration FILE by this test, never retyped here — a copy typed into a test
   agrees with whatever the test author believed, not with what 188 seeded.
2. C-7. The report says `$124.5` and `+18.2%`; it does NOT say `$124.5M`. Pinned so no later test
   asserts a literal the corpus never contained.
3. OS-STABLE HASHING (Pitfall 5). This repo checks out with `core.autocrlf=true`, so a CRLF working
   copy is the default on Windows. `corpus_version` and every per-file sha256 must be identical on
   a CRLF and an LF copy, or an install records a different version depending on who deployed it.
4. PATH CONTAINMENT (T-266-08). A slug and a manifest filename are validated before any filesystem
   access and every resolved path must stay inside CORPORA_ROOT and its slug directory.
5. THE EXTENSION CONTRACT (T-266-09). A corpus is DATA. Nothing under `backend/app/experts` is
   importable — no `__init__.py`, no `.py`.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from app.services import expert_corpus
from app.services.expert_corpus import (
    CorpusNotFound,
    CorpusRefused,
    ExpertCorpus,
    has_corpus,
    load_corpus,
    normalise_bytes,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_188 = REPO_ROOT / "supabase" / "migrations" / "188_expert_chat_scoping.sql"
SLUG = "financial-analyzer"
REPORT = "acme_q3_2026_financial_report.md"


def _extract_188_full_markdown() -> bytes:
    """The documents INSERT's full_markdown literal, taken from the migration file itself."""
    src = normalise_bytes(MIGRATION_188.read_bytes()).decode("utf-8")
    lines = src.split("\n")
    start = next(
        i for i, line in enumerate(lines)
        if line.lstrip().startswith("'# ACME Corporation - Q3 2026")
    )
    end = next(i for i in range(start, len(lines)) if lines[i].strip() == "now(),")
    body = "\n".join(lines[start:end]).lstrip()
    assert body.startswith("'") and body.endswith("',"), "188's literal shape moved — re-read the migration"
    return body[1:-2].replace("''", "'").encode("utf-8")


# ---------------------------------------------------------------------------------------------
# 1-2. Verbatim + C-7
# ---------------------------------------------------------------------------------------------


def test_corpus_bytes_equal_migration_188_full_markdown():
    literal = _extract_188_full_markdown()
    assert len(literal) == 2359, "188's literal measured 2,359 bytes LF at planning"
    corpus = load_corpus(SLUG)
    assert isinstance(corpus, ExpertCorpus)
    assert [f.filename for f in corpus.files] == [REPORT]
    assert corpus.files[0].raw == literal
    assert corpus.files[0].mime_type == "text/markdown"


def test_corpus_carries_the_figures_it_actually_has_c7():
    raw = load_corpus(SLUG).files[0].raw
    assert b"$124.5" in raw
    assert b"+18.2%" in raw
    # C-7: the report never says "$124.5M" or "124.5 million" — a test asserting either is
    # asserting a literal the corpus never had.
    assert b"$124.5M" not in raw
    assert b"124.5 million" not in raw


def test_loaded_bytes_carry_no_carriage_return():
    for f in load_corpus(SLUG).files:
        assert b"\r" not in f.raw


def test_manifest_folder_name():
    assert load_corpus(SLUG).folder_name == "Financial Reports & Filings"


# ---------------------------------------------------------------------------------------------
# 3. OS-stable hashing
# ---------------------------------------------------------------------------------------------


def test_normalise_bytes_only_converts_crlf():
    assert normalise_bytes(b"a\r\nb\r\n") == b"a\nb\n"
    # A lone CR is not a line ending this function owns — it is left alone.
    assert normalise_bytes(b"a\rb") == b"a\rb"
    assert normalise_bytes(b"") == b""


def test_corpus_version_is_identical_on_a_crlf_checkout(tmp_path, monkeypatch):
    real = load_corpus(SLUG)
    assert re.fullmatch(r"[0-9a-f]{64}", real.corpus_version)

    src_dir = expert_corpus.CORPORA_ROOT / SLUG
    dst_dir = tmp_path / SLUG
    dst_dir.mkdir()
    for p in src_dir.iterdir():
        data = normalise_bytes(p.read_bytes())
        (dst_dir / p.name).write_bytes(data.replace(b"\n", b"\r\n"))
    assert b"\r\n" in (dst_dir / REPORT).read_bytes(), "the CRLF copy must actually be CRLF"

    monkeypatch.setattr(expert_corpus, "CORPORA_ROOT", tmp_path.resolve())
    crlf = load_corpus(SLUG)

    assert crlf.corpus_version == real.corpus_version
    assert [f.sha256 for f in crlf.files] == [f.sha256 for f in real.files]
    assert crlf.files[0].raw == real.files[0].raw


def test_corpus_version_is_the_documented_derivation():
    import hashlib

    corpus = load_corpus(SLUG)
    for f in corpus.files:
        assert f.sha256 == hashlib.sha256(f.raw).hexdigest()
    joined = "".join(sorted(f"{f.filename}\t{f.sha256}\n" for f in corpus.files))
    assert corpus.corpus_version == hashlib.sha256(joined.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------------------------
# 4. Path containment (T-266-08)
# ---------------------------------------------------------------------------------------------


def test_has_corpus():
    assert has_corpus(SLUG) is True
    assert has_corpus("no-such-expert") is False
    assert has_corpus("../etc") is False
    assert has_corpus("") is False


@pytest.mark.parametrize("slug", ["../x", "Financial", "a/b", "", "..", "a\\b", "financial-analyzer/", "financial-analyzer\n"])
def test_load_corpus_refuses_malformed_slugs(slug):
    with pytest.raises(CorpusRefused):
        load_corpus(slug)


def test_load_corpus_not_found_for_wellformed_missing_slug():
    with pytest.raises(CorpusNotFound):
        load_corpus("no-such-expert")


@pytest.mark.parametrize("bad_name", ["../../secret.txt", "sub/x.md", "..", "a..b.md", "/etc/passwd", "C:x.md"])
def test_load_corpus_refuses_manifest_paths_that_escape(tmp_path, monkeypatch, bad_name):
    (tmp_path / "secret.txt").write_bytes(b"not yours")
    slug_dir = tmp_path / "evil"
    slug_dir.mkdir()
    (slug_dir / "sub").mkdir()
    (slug_dir / "sub" / "x.md").write_bytes(b"nested")
    (slug_dir / "manifest.json").write_text(
        json.dumps({"folder_name": "X", "files": [{"filename": bad_name, "mime_type": "text/plain"}]}),
        encoding="utf-8",
    )
    monkeypatch.setattr(expert_corpus, "CORPORA_ROOT", tmp_path.resolve())
    with pytest.raises(CorpusRefused):
        load_corpus("evil")


def test_load_corpus_not_found_when_manifest_missing(tmp_path, monkeypatch):
    (tmp_path / "empty").mkdir()
    monkeypatch.setattr(expert_corpus, "CORPORA_ROOT", tmp_path.resolve())
    with pytest.raises(CorpusNotFound):
        load_corpus("empty")
    assert has_corpus("empty") is False


# ---------------------------------------------------------------------------------------------
# 5. The Extension Contract (T-266-09)
# ---------------------------------------------------------------------------------------------


def test_corpus_directory_is_never_importable():
    experts_dir = expert_corpus.CORPORA_ROOT.parent
    assert experts_dir.name == "experts"
    assert list(experts_dir.rglob("__init__.py")) == []
    assert list(experts_dir.rglob("*.py")) == []


def test_corpora_root_is_under_backend_app():
    app_dir = Path(expert_corpus.__file__).resolve().parents[1]
    assert expert_corpus.CORPORA_ROOT == (app_dir / "experts" / "corpora").resolve()

