"""Phase 240 (SRC-05 SC#3 / D-240-07) — `GET /documents/{id}/conversation`, and what it refuses.

⛔ **THE READ THAT MAKES `thread_key` MORE THAN A COLUMN.** ROADMAP 240 names the alternative:
*"`thread_key` is stored and read by nothing — the exact fate `message_id` / `in_reply_to` /
`references` already suffered here."* A view filter is one read; this is the one a person can see.

⚠ **THE SECURITY SHAPE IS NOT THE USUAL ONE, AND IT IS WHY THE ENDPOINT TAKES A DOCUMENT ID
RATHER THAN A KEY.** A `thread_key` is derived from a `Message-ID`, which is chosen by whoever
SENT the mail. Anyone who can email this user can therefore choose a key, and a route that
accepted a key as a parameter would be a lookup handle an outsider gets to pick. The route
resolves the OPEN DOCUMENT first, under the caller's own auth, and only then asks for that
document's siblings **scoped to that document's owner**.
"""

from __future__ import annotations

from pathlib import Path

import pytest

_BACKEND = Path(__file__).resolve().parents[2]
_DOCUMENTS = _BACKEND / "app" / "api" / "documents.py"


def _code(path: Path) -> str:
    return "\n".join(
        line
        for line in path.read_text(encoding="utf-8").split("\n")
        if not line.lstrip().startswith("#")
    )


def test_the_route_exists_and_sits_with_the_other_detail_reads():
    src = _code(_DOCUMENTS)
    assert '"/{document_id}/conversation"' in src, (
        "there is no conversation route — thread_key is filterable and still invisible, which is "
        "the outcome ROADMAP 240 predicts for this column by name"
    )


def test_the_route_never_accepts_a_thread_key_from_the_caller():
    """⛔ TM-240-13 — the parameter list is the security boundary here.

    A `thread_key` query parameter would let anyone who can send this user an email choose a
    lookup handle. The signature must take a document id and nothing else.
    """
    src = _code(_DOCUMENTS)
    i = src.index('"/{document_id}/conversation"')
    signature = src[i : i + 700]
    assert "thread_key:" not in signature, (
        "the conversation route accepts a thread_key parameter — an attacker-chosen value must "
        "never be a lookup handle"
    )


def test_the_route_gates_on_document_visibility_before_reading_anything():
    """The 404-before-read gate the other four detail routes already share."""
    src = _code(_DOCUMENTS)
    i = src.index('"/{document_id}/conversation"')
    body = src[i : i + 2500]
    assert "_assert_document_visible" in body, (
        "the conversation route reads siblings without first proving the caller can see the "
        "document it was asked about"
    )
    gate = body.index("_assert_document_visible")
    read = body.index('.table("documents")', gate) if '.table("documents")' in body[gate:] else len(body)
    assert gate < read, "the sibling read happens before the visibility gate"


def test_the_sibling_query_is_user_scoped():
    """⛔ TM-240-13 again, at the query. Two users CAN share a thread_key."""
    src = _code(_DOCUMENTS)
    i = src.index('"/{document_id}/conversation"')
    body = src[i : i + 2500]
    # ⚠ THIS ASSERTION WAS BLIND ON ITS FIRST WRITING, AND THE DRIVE IS WHAT FOUND IT.
    #   It read `'"user_id"' in body`, and deleting `.eq("user_id", owner_id)` from the query
    #   left it GREEN — because `owner_id = parent.get("user_id")` two lines above still contains
    #   the string. A fence a neighbouring line can satisfy is not a fence, which is the trap
    #   `test_ingest_enrich_shared.py` recorded and this one walked straight into.
    #   It now matches the FILTER, and the deletion turns it red by name.
    key_at = body.index('.eq("thread_key"')
    assert '.eq("user_id", owner_id)' in body[:key_at], (
        "the sibling query is not scoped by user_id BEFORE the thread_key filter — a planted "
        "Message-ID would reach another person's mail (TM-240-13)"
    )


def test_the_cap_is_declared_and_the_truncation_is_reported():
    """⛔ TM-240-14 — a mailing-list archive can share one key across thousands of messages.

    ⚠ PostgREST caps at 1000 by DEFAULT, so an uncapped read truncates INVISIBLY — the trap
    `knowledge_health._fetch_readability` already records in its own comments. A cap that is not
    reported is the same lie in a different place.
    """
    src = _code(_DOCUMENTS)
    assert "CONVERSATION_SIBLING_CAP" in src, "the cap is a magic number rather than a named one"
    i = src.index('"/{document_id}/conversation"')
    body = src[i : i + 2500]
    assert "truncated" in body, (
        "the route caps its result and never says so — a silent slice is the defect"
    )


@pytest.mark.parametrize(
    "field", ["id", "title", "date", "sender", "is_open"]
)
def test_the_response_model_carries_what_the_panel_needs(field: str):
    """A Conversation row must be renderable without a second request per sibling."""
    from app.models.document import ConversationMessage

    assert field in ConversationMessage.model_fields, (
        f"ConversationMessage has no {field!r} — the panel would need another round trip"
    )


def test_a_document_with_no_thread_key_is_a_normal_empty_answer():
    """⚠ 200 + empty, never a 404 and never an error.

    "This document is not part of a conversation" is the ordinary case for almost every document
    in the Library. Treating it as an error would put a red state on every PDF.
    """
    src = _code(_DOCUMENTS)
    i = src.index('"/{document_id}/conversation"')
    body = src[i : i + 2500]
    assert "404" not in body.split("_assert_document_visible")[-1][:900], (
        "the conversation route raises a 404 of its own — an absent thread key is a normal "
        "answer, not a missing resource"
    )
