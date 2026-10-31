"""Phase 305-04 (GUARD-03; D-33 / D-56) — the deterministic redactor, pure and DB-free.

Every positive case in ``fixtures/phase305/redaction_cases.json`` is masked with exactly its
recognizer's mask (the whole value, nothing else); every negative case comes back byte-identical.
The masks are the five words the org admin card quotes (UI-SPEC §"What the caller's AI tool sees").
"""
from __future__ import annotations

import inspect
import json
import re
import time
from pathlib import Path

import pytest

from app.services import pii_redactor
from app.services.pii_redactor import DeterministicRedactor

CASES = json.loads(
    (Path(__file__).resolve().parents[1] / "fixtures" / "phase305" / "redaction_cases.json")
    .read_text(encoding="utf-8")
)
MASKS = CASES["masks"]
R = DeterministicRedactor()


def _text(case: dict) -> str:
    return case["text"] if "text" in case else "".join(case["text_parts"])


def _value(case: dict) -> str:
    return case["value"] if "value" in case else "".join(case["value_parts"])


@pytest.mark.parametrize("case", CASES["positive"], ids=lambda c: c["id"])
def test_every_positive_case_is_masked_with_its_recognizers_mask(case):
    text, value = _text(case), _value(case)
    assert text.count(value) == 1, "fixture error: the value must appear exactly once"
    expected = text.replace(value, MASKS[case["recognizer"]])
    assert R.redact(text) == expected


@pytest.mark.parametrize("case", CASES["negative"], ids=lambda c: c["id"])
def test_every_negative_case_is_returned_byte_identical(case):
    text = _text(case)
    assert R.redact(text) == text
    assert R.spans(text) == []


def test_the_masks_are_exactly_the_five_words_the_card_quotes():
    assert pii_redactor.MASKS == {
        "email": "[email removed]",
        "phone": "[phone removed]",
        "card": "[card number removed]",
        "iban": "[IBAN removed]",
        "secret": "[secret removed]",
    }
    from app.mcp.results import PASSAGE_CLOSE, PASSAGE_OPEN

    for mask in pii_redactor.MASKS.values():
        assert mask not in PASSAGE_OPEN and mask not in PASSAGE_CLOSE
        assert "RETRIEVED" not in mask and "-----" not in mask


def test_spans_are_ordered_non_overlapping_and_redact_never_touches_text_between_them():
    pieces = [(_text(c), _value(c), MASKS[c["recognizer"]]) for c in CASES["positive"]]
    text = " | ".join(t for t, _, _ in pieces)
    spans = R.spans(text)
    assert spans, "nothing matched"
    for (s1, e1, _m1), (s2, _e2, _m2) in zip(spans, spans[1:]):
        assert e1 <= s2
    for s, e, mask in spans:
        assert 0 <= s < e <= len(text) and mask in MASKS.values()
    out = R.redact(text)
    # Rebuild by hand: every byte outside a span is kept, every span becomes its mask.
    rebuilt, at = [], 0
    for s, e, mask in spans:
        rebuilt.append(text[at:s])
        rebuilt.append(mask)
        at = e
    rebuilt.append(text[at:])
    assert out == "".join(rebuilt)
    for _t, value, mask in pieces:
        assert value not in out
    assert len(spans) == len(pieces)


def test_an_empty_string_and_plain_prose_have_no_spans():
    assert R.spans("") == [] and R.redact("") == ""
    assert R.redact("Nothing personal here, only twelve percent growth.") == \
        "Nothing personal here, only twelve percent growth."


def test_the_redactor_is_named_and_in_house():
    assert R.name == "deterministic-v1"
    src = inspect.getsource(pii_redactor)
    imports = [ln for ln in src.splitlines() if re.match(r"^(from|import) ", ln)]
    assert not [ln for ln in imports if re.search(r"presidio|spacy|google\.cloud|boto", ln, re.I)]
    assert "NAMES ARE NOT COVERED" in src


def test_an_oversized_input_is_refused_rather_than_scanned():
    with pytest.raises(ValueError):
        R.spans("a" * (pii_redactor.MAX_INPUT + 1))


def test_an_8000_char_dense_chunk_redacts_in_under_20_ms():
    unit = (
        "Call +44 20 7946 0958 or mail jane.doe@example.com; card 4111 1111 1111 1111; "
        "IBAN GB82 WEST 1234 5698 7654 32; ref 123e4567-e89b-42d3-a456-426614174000; "
        "| 2019 | 2020 | 1 234 567 | 0.0042 | 98765 4321 | q7Xk2PzR9mLw4TcV8bNy3HdF6sGj1KaE5uYo0iZe\n"
    )
    chunk = (unit * (8000 // len(unit) + 1))[:8000]
    R.spans(chunk)  # warm the compiled patterns
    best = min(_timed(chunk) for _ in range(5))
    assert best < 0.020, f"{best * 1000:.2f} ms"


def test_a_read_chunk_of_single_digit_groups_stays_far_inside_the_deadline():
    """305-REVIEW-04 BL-04-01: every group start of a digit run is now a card candidate, so the
    worst case is a read chunk that is one long run of one-digit groups (measured ~30 ms)."""
    chunk = ("4 " * 4128)[:8256]
    R.spans(chunk)
    best = min(_timed(chunk) for _ in range(3))
    assert best < 0.250, f"{best * 1000:.2f} ms"


def _timed(chunk: str) -> float:
    t0 = time.perf_counter()
    R.redact(chunk)
    return time.perf_counter() - t0
