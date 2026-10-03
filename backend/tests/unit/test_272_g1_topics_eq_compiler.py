"""272 HUMAN-UAT gap G-1 — ``topics eq X`` in the SHARED view filter compiler.

The 272 review fix CR-01 rewrote ``topics eq`` only inside ``retrieval_scope`` (the
``search_documents`` path). ``query_documents_by_view``, Find and saved Views compile through
``view_filter_compiler._op_eq``, which still emitted a SCALAR ``metadata @> {"topics": "tax"}``
containment. ``topics`` is stored as a JSON ARRAY, so that never matched anything: measured
live (run ``376e459a``) as a false "No documents are tagged tax" while one was.

The compiled leg must match ONE ELEMENT of the array, case-insensitively, and never a
substring of an element ("tax" must not match "taxation").
"""

from __future__ import annotations

import json
import re

from app.models.document_view import ViewCondition, ViewFilter
from app.services.view_filter_compiler import compile_filter


def _compiled(field: str, value: str):
    return compile_filter(
        ViewFilter(op="and", conditions=[ViewCondition(field=field, op="eq", value=value)])
    )


def _ilike_matches(pattern: str, text: str) -> bool:
    """Postgres ILIKE semantics with backslash escapes: % = any run, _ = one char."""
    out, i = [], 0
    while i < len(pattern):
        ch = pattern[i]
        if ch == "\\" and i + 1 < len(pattern):
            out.append(re.escape(pattern[i + 1]))
            i += 2
            continue
        out.append(".*" if ch == "%" else "." if ch == "_" else re.escape(ch))
        i += 1
    return re.fullmatch("".join(out), text, flags=re.IGNORECASE | re.DOTALL) is not None


def _stored(topics: list[str]) -> str:
    """How ``metadata->>'topics'`` renders a jsonb array (``", "`` separators)."""
    return json.dumps(topics, ensure_ascii=False)


def test_topics_eq_is_not_a_scalar_containment():
    (frag,) = _compiled("topics", "tax")
    assert not (frag.leg == "containment" and frag.value == "tax"), (
        "topics eq compiled to a scalar @> containment, which never matches a JSON array"
    )


def test_topics_eq_matches_one_element_case_insensitively():
    (frag,) = _compiled("topics", "tax")
    assert frag.leg == "custom" and frag.builder == "ilike" and frag.field == "topics"
    assert _ilike_matches(frag.value, _stored(["Tax", "Audit"]))
    assert _ilike_matches(frag.value, _stored(["audit", "tax"]))


def test_topics_eq_never_matches_a_substring_of_an_element():
    (frag,) = _compiled("topics", "tax")
    assert not _ilike_matches(frag.value, _stored(["taxation", "Public policy"]))
    assert not _ilike_matches(frag.value, _stored(["withholding tax"]))


def test_topics_eq_value_is_matched_literally():
    (frag,) = _compiled("topics", "50%_off")
    assert _ilike_matches(frag.value, _stored(["50%_off"]))
    assert not _ilike_matches(frag.value, _stored(["50abcoff"]))


def test_non_list_fields_keep_their_legs():
    (lang,) = _compiled("language", "EN")
    assert (lang.leg, lang.builder, lang.value) == ("custom", "eq", "en")
    (title,) = _compiled("title", "Q3 report")
    assert (title.leg, title.builder) == ("custom", "ilike")
