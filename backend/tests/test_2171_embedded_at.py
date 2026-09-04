"""Phase 217.1 (BE-1 / LIB-01 / D-217.1-35) — ALL FOUR document_chunks write sites set embedded_at.

D-217.1-13 named TWO sites; D-217.1-35 corrected it to FOUR. A two-site plan leaves table/image
chunks NULL forever, and the Folders row (plan 09) would then read `never` for a folder that IS
indexed — the exact lie BE-1 exists to prevent, in a new place.

The four sites:
  1. `documents.py:2296-2308`      — INSERT — main text chunks
  2. `multimodal_service.py:423-432` — INSERT — table chunks
  3. `multimodal_service.py:896-908` — INSERT — image-description chunks
  4. `reembed_service.py:187-202`   — UPDATE — the re-embed path

Driving the full upload pipeline to a real chunk INSERT requires a multipart upload AND a mocked
embedding call, which would couple this suite to the pipeline's I/O. The honest, decoupled
coverage is a STRUCTURAL test: the payload dict literal at each named site carries `embedded_at`,
read from the source at the site's anchor. This is the same shape `test_migration_140.py` uses for
`resize_embedding_column` (read `prosrc`, assert the column), and it cannot pass on a two-site plan.
"""
import pytest


import pathlib

_BACKEND = pathlib.Path(__file__).resolve().parent.parent


def _read(rel: str) -> str:
    with open(_BACKEND / rel, encoding="utf-8") as f:
        return f.read()


def _site_snippet(source: str, start_marker: str, end_marker: str) -> str:
    """The source between two markers — the site's payload literal, isolated."""
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[start:end]


@pytest.mark.parametrize(
    "site,file,start,end",
    [
        # Site 1 — documents.py main-ingest chunk INSERT (:2296-2308). The literal starts at the
        # embedding_dimensions tag and ends at the zip that closes the chunk_rows comprehension.
        (
            "main ingest",
            "app/api/documents.py",
            "_chunk_embedding_dimensions,  # D-10",
            "for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))",
        ),
        # Site 2 — multimodal_service table-chunk INSERT (:423-432).
        (
            "table chunks",
            "app/services/multimodal_service.py",
            "_tbl_embedding_dimensions,",
            "for i, (chunk_text, embedding) in enumerate(zip(all_table_chunks, embeddings))",
        ),
        # Site 3 — multimodal_service image-chunk INSERT (:896-908).
        (
            "image chunks",
            "app/services/multimodal_service.py",
            "_img_embedding_dimensions,",
            "for (i, content), embedding in zip(descriptions, embeddings)",
        ),
        # Site 4 — reembed_service _write closure UPDATE (:187-202).
        (
            "re-embed UPDATE",
            "app/services/reembed_service.py",
            '"embedding": vec,',
            ".eq(\"id\", row[\"id\"])",
        ),
    ],
)
def test_write_site_sets_embedded_at(site, file, start, end):
    """The payload literal at each named site carries `embedded_at`."""
    source = _read(file)
    snippet = _site_snippet(source, start, end)
    assert "embedded_at" in snippet, (
        f"{site} write site ({file}) payload literal is missing `embedded_at` — "
        "BE-1 requires the honest 'when the vector was written' timestamp at ALL FOUR sites"
    )


def test_reembed_update_is_row_scoped_not_bulk():
    """Site 4's UPDATE is eq(id) AND eq(user_id) — never a bare bulk update.

    A bare `.update({...}).execute()` could silently backfill unrelated pre-existing rows. The
    re-embed _write closure scopes to the row by id and the user by RLS — assert the guard is in
    the same closure as the embedded_at write.
    """
    source = _read("app/services/reembed_service.py")
    start = source.index('"embedded_at": datetime.now(timezone.utc).isoformat()')
    closure = source[start : start + 400]
    assert '.eq("id", row["id"])' in closure, (
        "the re-embed UPDATE carrying embedded_at must be scoped eq(id) — a bulk update would "
        "backfill unrelated pre-existing rows"
    )
    assert '.eq("user_id", user_id)' in closure, (
        "the re-embed UPDATE must carry the RLS user_id scope (V4)"
    )
