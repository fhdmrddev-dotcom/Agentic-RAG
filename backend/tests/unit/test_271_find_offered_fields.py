"""Phase 271-04 (P-06 / RESEARCH Pitfall 1 / T-271-15) — Find offers no field the server rejects.

The ＋ condition popover on the Library's Documents tab (Find) is the shipped
``ConditionPopover``. Outside the watch scope it merges ``BUILTIN_FIELDS`` with
``WATCH_FIELDS`` — and three of the watch arrival facts (``name``, ``type``, ``size``) are NOT
in the resolver's whitelist, so offering them in Find would build a chip the server answers
with a 422. Find hides them through ``FIND_EXCLUDED_FIELD_KEYS``.

This suite reads the three literals straight out of the TSX source (no import of frontend
code) and checks them against the live Python whitelist:

  * every key Find still OFFERS (BUILTIN ∪ WATCH − excluded) is in
    ``_METADATA_BUILTINS ∪ _SOURCE_FACT_FIELDS`` — so no offered chip is one the server
    rejects;
  * every EXCLUDED key is NOT in that set — so the exclusion is necessary, not over-broad
    (excluding a valid field would silently remove a working filter).

Positive control: each parsed list must be non-empty. A regex that stopped matching would
otherwise make every ``for`` loop vacuous and the suite green over nothing.

Custom org fields are not checked here: they are, by construction, the enabled defs the
whitelist is built from.
"""

import re
from pathlib import Path

POPOVER = (
    Path(__file__).resolve().parents[3]
    / "frontend"
    / "src"
    / "components"
    / "ingestion"
    / "ConditionPopover.tsx"
)


def _array_body(source: str, name: str) -> str:
    m = re.search(rf"\b{name}\b[^=]*=\s*\[(.*?)\]", source, re.DOTALL)
    assert m, f"{name} array literal not found in ConditionPopover.tsx"
    return m.group(1)


def _field_keys(body: str) -> list[str]:
    return re.findall(r'field_key:\s*"([a-z_]+)"', body)


def _string_items(body: str) -> list[str]:
    return re.findall(r'"([a-z_]+)"', body)


def _parsed():
    source = POPOVER.read_text(encoding="utf-8")
    builtin = _field_keys(_array_body(source, "BUILTIN_FIELDS"))
    watch = _field_keys(_array_body(source, "WATCH_FIELDS"))
    excluded = _string_items(_array_body(source, "FIND_EXCLUDED_FIELD_KEYS"))
    return builtin, watch, excluded


def _server_whitelist() -> set[str]:
    from app.services.document_view_resolver import _METADATA_BUILTINS, _SOURCE_FACT_FIELDS

    return set(_METADATA_BUILTINS) | set(_SOURCE_FACT_FIELDS)


def test_positive_control_every_parsed_list_is_non_empty():
    builtin, watch, excluded = _parsed()
    assert len(builtin) >= 7, builtin
    assert len(watch) >= 7, watch
    assert excluded, "FIND_EXCLUDED_FIELD_KEYS parsed empty"
    # The control would be vacuous if the whitelist itself came back empty.
    assert "title" in _server_whitelist()


def test_every_field_find_offers_is_in_the_server_whitelist():
    builtin, watch, excluded = _parsed()
    offered = (set(builtin) | set(watch)) - set(excluded)
    rejected = sorted(offered - _server_whitelist())
    assert rejected == [], f"Find offers fields the server 422s: {rejected}"


def test_every_excluded_field_is_one_the_server_rejects():
    _, _, excluded = _parsed()
    wrongly_hidden = sorted(set(excluded) & _server_whitelist())
    assert wrongly_hidden == [], f"Find hides fields the server accepts: {wrongly_hidden}"


def test_the_exclusion_is_exactly_name_type_size():
    _, _, excluded = _parsed()
    assert sorted(excluded) == ["name", "size", "type"]
