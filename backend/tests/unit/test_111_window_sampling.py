"""Phase 111 Wave-0 (RED) — head+tail extraction window sampler (META-04).

`sample_for_extraction(text, cap)` replaces the hardwired `content[:3000]`:
  - returns the FULL text when len(text) <= cap;
  - returns head(70%) + an elision marker + tail(30%) when len(text) > cap,
    so late title/byline/date data after char 3000 is captured;
  - the elision marker `[...document body elided for metadata extraction...]`
    appears in the sampled result;
  - the tail contains the document's final characters.

RED convention: `sample_for_extraction` is built in Plan 02 (META-04). Import
inside each body; xfail until it lands.
"""

import pytest

ELISION = "[...document body elided for metadata extraction...]"


@pytest.mark.xfail(
    reason="sample_for_extraction not built until Plan 02 (META-04)",
    strict=False,
)
def test_full_text_returned_when_under_cap():
    from app.services.embedding_service import sample_for_extraction

    text = "short document body"
    out = sample_for_extraction(text, cap=32000)
    assert out == text, "text <= cap must be returned whole, unmodified"
    assert ELISION not in out, "no elision when under cap"


@pytest.mark.xfail(
    reason="sample_for_extraction not built until Plan 02 (META-04)",
    strict=False,
)
def test_head_and_tail_when_over_cap():
    from app.services.embedding_service import sample_for_extraction

    # Build a body with a unique head marker, a long filler, and a unique tail
    # marker (the late title/date the head[:3000] approach would MISS).
    head_marker = "HEAD_TITLE_MARKER"
    tail_marker = "TAIL_DATE_2026_06_15"
    body = head_marker + ("x" * 50000) + tail_marker
    cap = 10000

    out = sample_for_extraction(body, cap=cap)

    # Head retained.
    assert head_marker in out, "head data must survive sampling"
    # Tail retained — the whole point of head+tail over content[:3000].
    assert tail_marker in out, "tail data (late title/date) must survive sampling"
    # Elision marker present.
    assert ELISION in out, "elision marker must mark the dropped middle"
    # Result is bounded near the cap (not the full 50k+ body).
    assert len(out) < len(body), "sampled output must be smaller than the full body"
    # The tail of the sampled output ends with the document's final chars.
    assert out.rstrip().endswith(tail_marker), "sampled output must end with the doc tail"
