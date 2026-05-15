"""Phase 071.2 D-071.2-07 binding gate — markdown vs plain-text chunk differential.

Plan 03 swaps the chunker input from `doc.export_to_text()` to
`doc.export_to_markdown()`. The chunker's hierarchical separator list
(`\\n## `, `\\n### `, `\\n\\n`, ...) is designed to align with markdown
headings — feeding it plain text collapses those high-priority splits
and the chunker falls back to paragraph/sentence/char splits, which is
why thesis PDFs dropped to ~19 chunks under Docling.

These two tests pin the differential so the regression cannot silently
return:

  1. Markdown-shaped input must produce multiple chunks that begin with
     a literal `"## "` heading marker (proves the `\\n## ` priority
     separator is firing first, before `\\n\\n` / `. ` / etc.).
  2. The plain-text variant of the same content must produce at most as
     many chunks as the markdown variant (i.e. removing the `## `
     prefixes never INCREASES chunk count — the regression baseline for
     D-071.2-07).
"""
from __future__ import annotations

from app.services.embedding_service import chunk_text

# Multiple sections with realistic prose so the plain-text variant has
# an opportunity to fall back to `. ` / `\n` separators — otherwise the
# differential would trivially exist only because plain text is uncuttable.
_SECTIONS = [
    "Background",
    "Methods",
    "Results",
    "Discussion",
    "Conclusion",
    "References",
    "Appendix",
]
_PARA = "This is a sentence about the topic. " * 16  # ~580 chars, multi-period


def _build_markdown() -> str:
    return "\n".join(f"## {s}\n{_PARA}" for s in _SECTIONS)


def _build_plain() -> str:
    return "\n".join(f"{s}\n{_PARA}" for s in _SECTIONS)


def test_chunker_uses_markdown_separators_on_full_markdown():
    """Markdown headings trigger the `\\n## ` priority separator.

    Given seven `## `-prefixed sections with realistic prose padding,
    chunk_text must produce at least 2 chunks whose leading characters
    are `"## "` — proving the `\\n## ` separator was chosen first
    (before `\\n\\n` / `\\n` / `. ` / etc.).
    """
    md = _build_markdown()
    chunks = chunk_text(md, chunk_size=300, overlap=50)
    heading_starts = [c for c in chunks if c.startswith("## ")]
    assert len(heading_starts) >= 2, (
        f"Expected >=2 chunks starting with '## ', got {len(heading_starts)}; "
        f"chunks={chunks!r}"
    )


def test_chunker_collapses_on_plain_text_without_headings():
    """Plain-text variant produces <= chunks vs the markdown variant.

    Same characters minus the `## ` heading prefixes. Removing the
    `\\n## ` separators forces the chunker to fall back to lower-priority
    splits, so the plain-text variant must produce STRICTLY FEWER OR
    EQUAL chunks to the markdown variant. This is the regression baseline
    for D-071.2-07: when Docling fed plain text into chunk_text the
    thesis PDF dropped from ~400 to ~19 chunks.
    """
    md = _build_markdown()
    plain = _build_plain()

    chunks_md = chunk_text(md, chunk_size=300, overlap=50)
    chunks_plain = chunk_text(plain, chunk_size=300, overlap=50)

    assert len(chunks_plain) <= len(chunks_md), (
        f"Plain-text variant produced MORE chunks than markdown variant "
        f"(plain={len(chunks_plain)}, md={len(chunks_md)}); the markdown "
        f"separator priority is not functioning as designed."
    )
