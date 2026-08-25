"""BUG-260825-02 — `text/html` must not reach the chunker as raw markup.

⚠ THE ASSERTIONS HERE ARE ABOUT ABSENCE, WHICH IS THE WHOLE POINT. The shipped defect was
   that `extract_text(raw, "text/html")` returned its INPUT byte-identically, so a test
   shaped as "extraction returned text" passes against it. Tags flowed into the chunk text,
   into the embeddings, and into whatever the agent later quoted to a person.

⚠ THE CONVERTER UNDER TEST IS THE EMAIL PARSER'S `html_to_plain_text` — stdlib
   `html.parser`, no new dependency. `beautifulsoup4` was the report's suggested route and
   would have shipped a CLOUD-ONLY `ImportError`: it is present in the local venv but is NOT
   declared in `backend/requirements.txt`, so the deployed image does not have it.
"""
from __future__ import annotations

import app.main  # noqa: F401  — app.api.* cannot be imported standalone
from app.api.documents import extract_text


def test_html_extraction_leaves_no_markup_behind() -> None:
    """⚠ ASSERTS ABSENCE, NOT PRESENCE. `assert text` passed against the defect: the
    extractor returned its INPUT, tags and all."""
    raw = (
        b"<html><head><style>p{color:red}</style><title>t</title></head><body>"
        b"<h1>Quarterly Note</h1><p>Revenue rose 12&nbsp;percent &amp; margin held.</p>"
        b"<script>var leak='do not embed me';</script></body></html>"
    )
    text = extract_text(raw, "text/html")

    assert "Quarterly Note" in text
    assert "margin held" in text
    for token in ("<h1>", "</h1>", "<p>", "</p>", "<script", "<style", "<html", "<body"):
        assert token not in text, "markup survived extraction: " + repr(token)
    assert "do not embed me" not in text, "script body reached the embedding text"
    assert "var leak" not in text
    assert "color:red" not in text
    assert "&amp;" not in text and "&" in text, "entities must be unescaped, not passed through"


def test_html_extraction_is_not_the_identity_function() -> None:
    """The regression that shipped: the output was byte-identical to the input."""
    raw = b"<h1>Quarterly Note</h1><p>Revenue rose 12%.</p>"
    assert extract_text(raw, "text/html") != raw.decode("utf-8")


