"""Phase 269 (PACK-26 / PACK-27 / D-269-04 / D-269-05) — the starter Expert corpora contract.

Every starter Expert ships a corpus as DATA under ``backend/app/experts/corpora/<slug>/``. This file
pins what the live drive (269-03) depends on, BEFORE any drive happens:

1. THE SET IS DERIVED, NEVER A CONSTANT. ``SLUGS`` is read from ``CORPORA_ROOT.iterdir()``. A
   collapse guard refuses to pass over fewer than five corpora, and a bijection check refuses a
   figure map for a corpus that does not exist (or a corpus with no figure map).
2. EVERY CORPUS LOADS through the unchanged Phase 266 loader (D-269-08) — text mime, LF only.
3. UNIQUENESS ACROSS CORPORA (M-13 / T-269-04). folder_name, filename and sha256 are unique, so an
   install never 409s on duplicate bytes and two Experts never collide on one Library folder.
4. EACH CITED FIGURE LIVES IN EXACTLY ONE CORPUS (D-269-05). The figure is invented and company-
   specific, so a model citing it proves retrieval — and only one Expert's corpus can supply it.
5. EACH REFUSAL QUESTION IS ANSWERED BY A SIBLING (RESEARCH Pattern 3). The answer literal is present
   in the sibling's corpus and ABSENT from the asking Expert's own, so a restricted Expert that
   answers it has leaked scope.
6. LABELS, SIZES, SHAPE (D-269-04). Every new file opens with a SAMPLE DATA line naming the company
   fictional. The Financial Analyzer file is exempt — it is pinned verbatim to migration 188.
7. PROMPT-INJECTION HYGIENE (T-269-03). Corpus text reaches the model as retrieved context, so no new
   file may carry text addressed to an assistant.
"""

from __future__ import annotations

import json

import pytest

from app.services.expert_corpus import CORPORA_ROOT, MANIFEST_NAME, load_corpus

# The Financial Analyzer is pinned verbatim to migration 188 (test_266_corpus_verbatim.py) and is
# therefore exempt from the label / size / manifest-shape rules the NEW corpora follow.
PINNED_VERBATIM = {"financial-analyzer"}

SLUGS = sorted(p.name for p in CORPORA_ROOT.iterdir() if p.is_dir())
NEW_SLUGS = [s for s in SLUGS if s not in PINNED_VERBATIM]

# Starter Contract (269-01-PLAN.md, identical in 269-02) — the literals each Expert's live answer
# will cite. C-7: assert only what the file actually contains.
EXPECTED_FIGURES: dict[str, list[bytes]] = {
    "financial-analyzer": [b"$124.5", b"+18.2%", b"30.8%", b"$29.1"],
    "contract-reviewer": [b"$2.35M", b"75 days"],
    "hr-policy-advisor": [b"23 days", b"18 weeks", b"$1,850"],
    "security-compliance": [b"36 hours", b"14 of 16"],
    "operations-analyst": [b"94.7%", b"38 days", b"41%"],
}

# asking slug -> (sibling slug that answers the out-of-scope question, the answer literal)
REFUSAL_LITERALS: dict[str, tuple[str, bytes]] = {
    "financial-analyzer": ("hr-policy-advisor", b"23 days"),
    "contract-reviewer": ("operations-analyst", b"94.7%"),
    "hr-policy-advisor": ("contract-reviewer", b"$2.35M"),
    "security-compliance": ("financial-analyzer", b"$124.5"),
    "operations-analyst": ("hr-policy-advisor", b"18 weeks"),
}

INJECTION_MARKERS = (
    "ignore previous",
    "ignore all",
    "you are an",
    "as an ai",
    "system prompt",
    "assistant:",
)

MIN_FILE_BYTES = 1_000
MAX_FILE_BYTES = 6_000


def _raw_by_slug() -> dict[str, bytes]:
    return {s: b"\n".join(f.raw for f in load_corpus(s).files) for s in SLUGS}


# ---------------------------------------------------------------------------------------------
# 1. The derived set
# ---------------------------------------------------------------------------------------------


def test_derived_slug_set_has_not_collapsed():
    assert len(SLUGS) >= 5, f"derived corpus set collapsed to {SLUGS} — a fence over nothing is vacuous"


def test_figure_map_is_a_bijection_with_the_corpus_directories():
    assert set(SLUGS) == set(EXPECTED_FIGURES), (
        f"corpora on disk {sorted(SLUGS)} != figure map {sorted(EXPECTED_FIGURES)}"
    )
    assert set(SLUGS) == set(REFUSAL_LITERALS)


# ---------------------------------------------------------------------------------------------
# 2. Every corpus loads, text only
# ---------------------------------------------------------------------------------------------


@pytest.mark.parametrize("slug", SLUGS)
def test_every_corpus_loads_as_lf_text(slug):
    corpus = load_corpus(slug)
    assert corpus.files, slug
    for f in corpus.files:
        assert f.mime_type.startswith("text/"), (slug, f.filename, f.mime_type)
        assert b"\r" not in f.raw, (slug, f.filename)


# ---------------------------------------------------------------------------------------------
# 3. Uniqueness across corpora (M-13)
# ---------------------------------------------------------------------------------------------


def test_folder_names_filenames_and_hashes_are_unique_across_corpora():
    corpora = [load_corpus(s) for s in SLUGS]
    folders = [c.folder_name for c in corpora]
    names = [f.filename for c in corpora for f in c.files]
    hashes = [f.sha256 for c in corpora for f in c.files]
    assert len(set(folders)) == len(folders), folders
    assert len(set(names)) == len(names), names
    assert len(set(hashes)) == len(hashes), "two corpus files carry identical bytes (M-13 409 at install)"


# ---------------------------------------------------------------------------------------------
# 4. Cited figures — exactly one corpus each
# ---------------------------------------------------------------------------------------------


def test_each_cited_figure_lives_in_exactly_one_corpus_and_it_is_its_own():
    raw = _raw_by_slug()
    for slug, figures in EXPECTED_FIGURES.items():
        for fig in figures:
            holders = [s for s in SLUGS if fig in raw.get(s, b"")]
            assert holders == [slug], f"{fig!r} expected only in {slug}, found in {holders}"


# ---------------------------------------------------------------------------------------------
# 5. Refusal questions — answered by the sibling, absent from the asker
# ---------------------------------------------------------------------------------------------


def test_each_refusal_answer_is_in_the_sibling_and_absent_from_the_asker():
    raw = _raw_by_slug()
    for asker, (sibling, literal) in REFUSAL_LITERALS.items():
        assert sibling != asker
        assert literal in raw.get(sibling, b""), f"{literal!r} missing from sibling {sibling}"
        assert literal not in raw.get(asker, b""), f"{literal!r} leaked into asker {asker}'s own corpus"


# ---------------------------------------------------------------------------------------------
# 6. Labels, sizes, manifest shape (new corpora only)
# ---------------------------------------------------------------------------------------------


@pytest.mark.parametrize("slug", NEW_SLUGS)
def test_new_corpus_files_open_with_a_sample_data_label(slug):
    for f in load_corpus(slug).files:
        first = f.raw.split(b"\n", 1)[0].decode("utf-8")
        assert first.startswith("> SAMPLE DATA:"), (slug, f.filename, first)
        assert "fictional" in first, (slug, f.filename, first)


@pytest.mark.parametrize("slug", NEW_SLUGS)
def test_new_corpus_has_two_files_of_sane_size(slug):
    files = load_corpus(slug).files
    assert len(files) == 2, (slug, [f.filename for f in files])
    for f in files:
        assert MIN_FILE_BYTES <= len(f.raw) <= MAX_FILE_BYTES, (slug, f.filename, len(f.raw))


@pytest.mark.parametrize("slug", NEW_SLUGS)
def test_new_corpus_manifest_has_exactly_the_two_read_keys(slug):
    manifest = json.loads((CORPORA_ROOT / slug / MANIFEST_NAME).read_text(encoding="utf-8"))
    assert set(manifest) == {"folder_name", "files"}, (slug, sorted(manifest))


# ---------------------------------------------------------------------------------------------
# 7. Prompt-injection hygiene (T-269-03)
# ---------------------------------------------------------------------------------------------


@pytest.mark.parametrize("slug", NEW_SLUGS)
def test_new_corpus_carries_no_instruction_like_text(slug):
    for f in load_corpus(slug).files:
        text = f.raw.decode("utf-8").lower()
        hits = [m for m in INJECTION_MARKERS if m in text]
        assert hits == [], (slug, f.filename, hits)
