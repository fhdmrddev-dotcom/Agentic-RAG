"""DEBT-09 (Phase 278) — the ONE home of the document-filter vocabulary.

Holds two things that used to be typed by hand in several modules (and had already drifted: the date
map existed with four entries in one place and three in another):

* ``TIMESTAMP_DATE_COLUMNS`` — Find's three timestamptz date words → their ``public.documents`` column.
* ``LIST_FIELD_NAMES`` — built-in metadata fields stored as a JSON ARRAY (the "topics is a list" rule).

Imported by ``retrieval_scope.py``, ``document_search_service.py`` and ``view_filter_compiler.py``.

⛔ **What this module is NOT:** it does no I/O and imports nothing from ``app`` — it is a leaf, so any
of the Find / Views / agent-filter stacks can import it without adding a cycle edge. ``date`` →
``date_typed`` (the document's own date) is deliberately ABSENT: it is a compiler field (D-05 /
Pitfall 14), and ``retrieval_scope`` adds it as a named extension of this map. The frontend's
``findState.ts`` 3-word type is the wire contract and is out of scope (D-14).

``tests/unit/test_278_vocabulary_one_home.py`` fails on any literal copy of either value elsewhere in
``backend/app``, and on a named module that stops importing it.
"""
from __future__ import annotations

# Find's three timestamptz dates resolve through ``FindDate`` (Pitfall 14: BEFORE the compiler, so a
# custom key spelled ``added`` can never shadow them). ``date`` — the document's own date — is NOT
# here: it is the compiler's ``date_typed`` field (D-05).
TIMESTAMP_DATE_COLUMNS: dict[str, str] = {
    "added": "created_at",
    "source_created": "source_created_at",
    "source_modified": "source_modified_at",
}

# 272-REVIEW CR-01 — built-in fields stored as a JSON ARRAY (DocumentMetadata.topics: list[str]).
# The compiler's `eq` is a SCALAR `metadata @> {"topics": "tax"}` containment, which never matches
# `["tax", "audit"]`, and `one_of` compares the array's TEXT to each value — both silently match
# nothing, and the D-09 lock then holds the agent to a false "nothing exists". So `eq` is handed to
# the compiler as a case-insensitive match on the JSON-quoted ELEMENT; `contains` / `is_empty`
# already work on the text; every other op is refused. ⛔ Tests pin this tuple to the list-typed
# DocumentMetadata fields (test_272_review_fixes.py).
LIST_FIELD_NAMES: tuple[str, ...] = ("topics",)
