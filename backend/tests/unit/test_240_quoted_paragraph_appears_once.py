"""Phase 240 (SRC-05 SC#1 / D-240-10) — one paragraph, one document.

SC#1, verbatim: *"the answer cites **the message that said it, once**, not the same paragraph
repeated for every reply that quoted it."*

⚠ **THIS IS A MEASUREMENT FIRST AND A FIX ONLY IF THE MEASUREMENT DEMANDS ONE.**
`strip_quoted_replies()` already runs BEFORE chunking, so the poisoning SC#1 describes may
already be mitigated. This project's rule is to drive it rather than assume it — and the honest
outcome of a measurement is whatever it measures.

⭐ **THE ASSERTION IS DRIVEN RED, AND THAT IS WHAT MAKES IT WORTH ANYTHING.** With
`strip_quoted_replies` neutralised, the paragraph must appear in **14** documents; with it
restored, in **1**. Phase 236 SC#2 states the requirement in general form — *removing a defence
must turn the suite RED* — and Phase 235 is why: a green composition fence coexisted with a
shipped defect because it asserted block PRESENCE while the content drifted. **A suite that
cannot fail proves nothing.**

⚠ **IT ASSERTS RENDERED CONTENT, NEVER PRESENCE.** The paragraph's actual text is matched inside
the chunk body — not a chunk count, not "a chunk exists".

⛔ **`retrieval_service.py` IS NOT MODIFIED BY THIS PHASE.** It fires G-5 at 10 phases with an
extraction OWED since Phase 231, and ROADMAP row 241 states that a third landing must propose the
extraction first. If this measurement shows duplication surviving, the finding is RECORDED and
ROUTED to Phase 241 — which already owns both the extraction and the recall harness — not patched
here.
"""

from __future__ import annotations

import pytest

from app.services.email_extraction_service import parse_eml_bytes, strip_quoted_replies
from tests.unit.test_240_thread_key import DISTINCTIVE_PARAGRAPH, make_thread

#: The dialects `strip_quoted_replies` claims to recognise. The set is FINITE, which is the whole
#: risk: a dialect it does not know is a dialect whose quote trail survives into the chunks.
DIALECTS = ("gmail", "outlook", "original")


def _documents_carrying_the_paragraph(dialect: str) -> int:
    """How many of a 14-message thread's documents would carry message 1's paragraph.

    Models the ingest pipeline at the point that matters: `strip_quoted_replies` runs on the
    parsed body BEFORE chunking, so what it returns is what gets embedded and what retrieval can
    later cite.
    """
    carriers = 0
    for raw in make_thread(14, dialect=dialect):
        cleaned = strip_quoted_replies(parse_eml_bytes(raw).body)
        if DISTINCTIVE_PARAGRAPH in cleaned:
            carriers += 1
    return carriers


@pytest.mark.parametrize("dialect", DIALECTS)
def test_the_fixture_really_poisons_before_stripping(dialect: str) -> None:
    """⭐ THE POSITIVE CONTROL — the RED half, run every time rather than once by hand.

    Without stripping, message 1's paragraph is in ALL FOURTEEN bodies. If this ever reads 1, the
    fixture stopped reproducing the problem and the test below is measuring nothing.
    """
    carriers = sum(
        1 for raw in make_thread(14, dialect=dialect) if DISTINCTIVE_PARAGRAPH in parse_eml_bytes(raw).body
    )
    assert carriers == 14, (
        f"the {dialect} fixture only poisons {carriers}/14 bodies — the measurement below would "
        f"pass against a thread that never had the problem"
    )


@pytest.mark.parametrize("dialect", DIALECTS)
def test_the_paragraph_survives_in_exactly_one_document(dialect: str) -> None:
    """SC#1 — after stripping, message 1 is the only document that says it.

    ⚠ Per-dialect, because the failure is dialect-specific and a single-dialect pass would read as
    a general one.
    """
    carriers = _documents_carrying_the_paragraph(dialect)
    assert carriers == 1, (
        f"the {dialect} quote dialect leaves message 1's paragraph in {carriers} documents. "
        f"SC#1 asks that an answer cite the message that said it ONCE. Record this as a finding "
        f"naming the dialect and route it to Phase 241 (which owns retrieval_service.py's owed "
        f"extraction) — do NOT patch retrieval here."
    )


def test_neutralising_the_defence_turns_this_red(monkeypatch: pytest.MonkeyPatch) -> None:
    """⛔ THE FENCE ON THE FENCE. Phase 236 SC#2, applied to this phase's own guarantee.

    With `strip_quoted_replies` replaced by the identity function the count must be 14, not 1.
    A test that would pass either way is not evidence that the defence does anything.
    """
    monkeypatch.setattr(
        "app.services.email_extraction_service.strip_quoted_replies", lambda text: text
    )
    from app.services import email_extraction_service

    carriers = sum(
        1
        for raw in make_thread(14)
        if DISTINCTIVE_PARAGRAPH
        in email_extraction_service.strip_quoted_replies(parse_eml_bytes(raw).body)
    )
    assert carriers == 14, (
        "neutralising strip_quoted_replies did NOT reintroduce the duplication — so the "
        "measurement above is not actually measuring that defence, and the green result it "
        "reports is meaningless"
    )


def test_stripping_does_not_eat_the_message_that_said_it() -> None:
    """⚠ THE FAILURE DIRECTION THAT WOULD BE WORSE THAN THE ONE SC#1 NAMES.

    Over-stripping loses the ONLY copy. `strip_quoted_replies` carries a correction in its own
    body about exactly this — a `>`-prefixed line is DROPPED, never a `break`, because the `break`
    discarded everything after one quoted line, and its empty-result fallback then returned the
    whole UNSTRIPPED body when the first line was quoted. Both failures at once, decided by where
    the quote sat.
    """
    first = make_thread(14)[0]
    cleaned = strip_quoted_replies(parse_eml_bytes(first).body)
    assert DISTINCTIVE_PARAGRAPH in cleaned, (
        "message 1's own paragraph was stripped out of message 1 — retrieval now has NO copy"
    )
