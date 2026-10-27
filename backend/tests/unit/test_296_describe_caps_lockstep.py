"""296-05 (inventory row 291-R1-IN-01) — the describe door's client caps move in LOCKSTEP with the server's.

``useTemplateFirstDraft.ts`` mirrors the generate body's caps so the browser never builds a body
the server would refuse (291-04, raised at 291-06 CR-02). 291-REVIEW-R1 IN-01 found nothing tied
the two together: raise one side and the other keeps its old number silently — a client cap
BELOW the server's refuses real forms for no reason, one ABOVE it builds bodies that 422.

This file reads the frontend constants AS TEXT (no TS toolchain in the backend suite) and
asserts each equals the server constant or Pydantic bound it mirrors. The server stays
authoritative; this only makes a drift loud.

⚠ Non-vacuity: every client constant must be FOUND in the file, and the pair table is checked
for size, so a renamed constant fails here instead of dropping out of the comparison.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

_REPO = Path(__file__).resolve().parents[3]
_HOOK = _REPO / "frontend" / "src" / "components" / "workflows" / "useTemplateFirstDraft.ts"


def _client_consts() -> dict[str, str]:
    """`const NAME = <rhs>` (optionally exported) at the top level of the hook, rhs as text."""
    src = _HOOK.read_text(encoding="utf-8")
    return {
        m.group(1): m.group(2).strip()
        for m in re.finditer(r"(?m)^(?:export\s+)?const\s+([A-Z][A-Z0-9_]+)\s*=\s*(.+?)\s*$", src)
    }


def _num(rhs: str) -> int:
    """A numeric TS literal or product (`10 * 1024 * 1024`, `250_000`); anything else fails."""
    if not re.fullmatch(r"[0-9_]+(?:\s*\*\s*[0-9_]+)*", rhs):
        raise AssertionError(f"not a plain numeric expression: {rhs!r}")
    out = 1
    for part in rhs.split("*"):
        out *= int(part.strip().replace("_", ""))
    return out


def _max_length(model, field: str) -> int:
    for meta in model.model_fields[field].metadata:
        if getattr(meta, "max_length", None) is not None:
            return meta.max_length
    raise AssertionError(f"{model.__name__}.{field} carries no max_length")


def _server_values() -> dict[str, int]:
    from app.api import workflow_authoring_doors as doors
    from app.services import workspace_service

    enum_item_max = None
    for meta in doors.DescribeFormFieldIn.model_fields["enum_options"].metadata:
        if getattr(meta, "max_length", None) is not None:
            enum_item_max = meta.max_length
    return {
        "REFERENCE_LIMIT": _max_length(doors.GenerateRequest, "references"),
        "REFERENCE_MAX_BYTES": workspace_service.MAX_FILE_SIZE,
        "FORM_FIELDS_MAX": _max_length(doors.DescribeFormIn, "fields"),
        "FORM_TEXT_MAX": doors._GENERATE_TEXT_MAX,
        "FORM_LABEL_MAX": _max_length(doors.DescribeFormFieldIn, "label"),
        "FORM_ENUM_MAX": enum_item_max,
        "FORM_OPTIONS_TOTAL_MAX": doors._FORM_OPTIONS_TOTAL_MAX,
    }


_PAIRS = (
    "REFERENCE_LIMIT",
    "REFERENCE_MAX_BYTES",
    "FORM_FIELDS_MAX",
    "FORM_TEXT_MAX",
    "FORM_LABEL_MAX",
    "FORM_ENUM_MAX",
    "FORM_OPTIONS_TOTAL_MAX",
)


def test_every_mirrored_client_cap_is_found():
    consts = _client_consts()
    missing = [n for n in _PAIRS if n not in consts]
    assert not missing, f"client cap(s) renamed or removed from {_HOOK.name}: {missing}"
    assert len(_PAIRS) == 7


@pytest.mark.parametrize("name", _PAIRS)
def test_the_client_cap_equals_the_server_cap(name):
    client = _num(_client_consts()[name])
    server = _server_values()[name]
    assert server is not None, f"no server value for {name}"
    assert client == server, (
        f"{name}: the client mirrors {client}, the server enforces {server}. Move both in the "
        "same commit (the server is authoritative)."
    )


def test_the_field_key_rule_is_the_same_character_class():
    """The client's FIELD_KEY_FORBIDDEN and the server's _FIELD_KEY_FORBIDDEN refuse the same set."""
    from app.api import workflow_authoring_doors as doors

    rhs = _client_consts()["FIELD_KEY_FORBIDDEN"]
    m = re.fullmatch(r"/(.+)/", rhs)
    assert m, rhs
    client_class = m.group(1)
    assert client_class == doors._FIELD_KEY_FORBIDDEN.pattern, (
        f"client {client_class!r} vs server {doors._FIELD_KEY_FORBIDDEN.pattern!r}"
    )
    # and the server pattern really refuses what both claim to
    for ch in "{}<>\x00\x1f\x7f":
        assert doors._FIELD_KEY_FORBIDDEN.search(ch)
    assert not doors._FIELD_KEY_FORBIDDEN.search("Legal name")


def test_the_number_parser_refuses_what_it_cannot_read():
    """Counterfactual: a cap written as a call or an identifier must not read as a number."""
    with pytest.raises(AssertionError):
        _num("Math.max(1, 2)")
    with pytest.raises(AssertionError):
        _num("SOME_OTHER_CAP")
    assert _num("10 * 1024 * 1024") == 10 * 1024 * 1024
    assert _num("250_000") == 250_000
