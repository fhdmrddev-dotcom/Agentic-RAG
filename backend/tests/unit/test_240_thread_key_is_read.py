"""Phase 240 (SRC-05 / D-240-07) — `thread_key` is WRITTEN BY BOTH PATHS and READ by something.

⛔ **TWO FAILURE MODES, AND THIS FILE EXISTS FOR BOTH.**

1. **Written by one path only.** `ingest_splice.py`'s own comments narrate three separate
   occasions where a step existed on the legacy path and not the queue path — the metadata step
   (BUG-260905-06), the empty-chunk refusal, and the Phase 234 provenance carry. Each was
   invisible to a suite of thousands because *both paths had tests and neither test asserted the
   two paths AGREE*. `240-03` is about to find a fourth. This file refuses to add a fifth.

2. **Stored and read by nothing.** ROADMAP 240 names this outcome for this exact column, and
   points at the precedent: `email_message_id` / `email_in_reply_to` / `email_references` have
   been written into `metadata` since Phase 203 and are read back by nothing at all. A fourth
   write would satisfy SRC-05's letter and none of its point.

⚠ **The both-paths tests read SOURCE, not a database, and that is deliberate rather than a
compromise.** `test_ingest_enrich_shared.py` established the technique for this exact class of
bug and recorded why: a per-path behavioural test *"can only ever prove a path does what it
does"*. What has to be asserted is the AGREEMENT. ⚠ It also recorded the trap — an early version
matched a bare string and stayed green when the fix was reverted, because the explanatory comment
still contained the name. **A fence satisfied by a comment is not a fence**, so every assertion
below excludes comment lines.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.models.document_view import ViewCondition, ViewFilter
from app.services.email_extraction_service import parse_eml_bytes, thread_key_for
from app.services.ingest_enrich import EnrichedIngest
from app.services.view_filter_compiler import (
    PROMOTED_TYPED_COLUMNS,
    compile_filter,
    validate_fields,
)
from tests.unit.test_240_thread_key import make_thread

_BACKEND = Path(__file__).resolve().parents[2]
_SPLICE = _BACKEND / "app" / "services" / "ingest_splice.py"
_DOCUMENTS = _BACKEND / "app" / "api" / "documents.py"
_ENRICH = _BACKEND / "app" / "services" / "ingest_enrich.py"
_RESOLVER = _BACKEND / "app" / "services" / "document_view_resolver.py"


def _code_lines(path: Path) -> list[str]:
    """Source with comment-only lines removed — a fence a comment can satisfy is not a fence."""
    return [
        line
        for line in path.read_text(encoding="utf-8").split("\n")
        if not line.lstrip().startswith("#")
    ]


def _code(path: Path) -> str:
    return "\n".join(_code_lines(path))


# ── 1. both paths write it ──────────────────────────────────────────────────────────────────


def test_both_ingest_paths_write_thread_key():
    """⭐ THE ONE TEST THAT WOULD CATCH THE FIFTH DISAGREEMENT.

    ⚠ Driven RED by deleting the write from ONE path at a time; each deletion failed naming the
    path that lost it.
    """
    for path in (_SPLICE, _DOCUMENTS):
        uses = [
            line
            for line in _code_lines(path)
            if "thread_key" in line and not line.lstrip().startswith(("from ", "import "))
        ]
        assert uses, (
            f"{path.name} does not USE thread_key — the conversation key is missing from an "
            f"ingest path, which is how the metadata step went missing in BUG-260905-06"
        )
        assert any('"thread_key"' in line for line in uses), (
            f"{path.name} mentions thread_key but never writes the COLUMN — deriving a value "
            f"and not persisting it is the same outcome as never deriving it"
        )


def test_neither_path_derives_it_privately():
    """One derivation, two callers. A second copy is how two paths start to disagree."""
    for path in (_SPLICE, _DOCUMENTS):
        src = _code(path)
        assert "thread_key_for(" not in src, (
            f"{path.name} calls thread_key_for directly — the derivation belongs in "
            f"ingest_enrich.py, where BOTH paths already meet"
        )
    assert "thread_key_for(" in _code(_ENRICH), (
        "the shared enrichment step no longer derives the thread key at all"
    )


def test_the_column_is_never_written_as_null_over_an_existing_value():
    """⚠ BUG-260905-07's lesson, applied to the new column BEFORE it can be paid for again.

    A re-ingest whose enrichment degrades must not erase a key the row already had. Both paths
    splice the key conditionally, exactly as they already splice metadata.
    """
    splice = _code(_SPLICE)
    documents = _code(_DOCUMENTS)
    assert re.search(
        r'\{"thread_key": enriched\.thread_key\}\s*\n?\s*if enriched\.thread_key is not None',
        splice,
    ), "the queue path writes thread_key unconditionally — a None would clear an existing row"
    assert re.search(
        r'\{"thread_key": thread_key\} if thread_key is not None else \{\}', documents
    ), "the legacy path writes thread_key unconditionally"


# ── 2. the value is right ───────────────────────────────────────────────────────────────────


def test_a_fourteen_message_thread_yields_one_key():
    """SC#3's substrate, at the level the column will actually carry."""
    keys = {thread_key_for(parse_eml_bytes(raw)) for raw in make_thread(14)}
    assert keys == {"msg-1@example.com"}


def test_a_reply_that_arrives_later_joins_the_existing_conversation():
    """⭐ SC#3 stated exactly: a reply arriving AFTER the rest must not start a second group.

    The thread is built in two batches to model the real sequence — thirteen messages ingested,
    then a fourteenth arriving on a later watch pass.
    """
    thread = make_thread(14)
    first_13 = {thread_key_for(parse_eml_bytes(r)) for r in thread[:13]}
    late_arrival = thread_key_for(parse_eml_bytes(thread[13]))
    assert len(first_13) == 1
    assert late_arrival in first_13, "the late reply started a second conversation"


def test_a_document_that_is_not_mail_carries_no_key():
    """The nullable column's whole point: "not mail" stays tellable from "mail with no headers"."""
    assert EnrichedIngest(
        text="", metadata=None, context_header="", vision=None
    ).thread_key is None


# ── 3. something READS it ───────────────────────────────────────────────────────────────────


def test_thread_key_is_a_promoted_typed_column():
    """A view filter can name it, and it compiles to the INDEXED column, not a metadata probe."""
    assert PROMOTED_TYPED_COLUMNS.get("thread_key") == "thread_key"


def test_a_thread_key_filter_compiles_to_the_typed_leg():
    """⚠ The typed leg is what uses `documents_thread_key_idx`.

    A `metadata->>` custom leg would still return correct rows and would scan the table — right
    answer, wrong plan, and invisible until the corpus is large. Phase 241 is the phase that
    would have paid for it.
    """
    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="thread_key", op="eq", value="msg-1@example.com")],
    )
    fragments = compile_filter(flt)
    assert len(fragments) == 1
    frag = fragments[0]
    assert frag.leg == "typed", f"thread_key compiled to the {frag.leg!r} leg, not a column"
    assert frag.field == "thread_key"
    assert frag.value == "msg-1@example.com"


def test_the_resolver_whitelist_admits_thread_key():
    """⛔ ALL THREE LEGS, not just the compiler.

    Phase 237 had to close a whitelist BYPASS at `document_view_resolver.py:197` after promoting
    the source facts — a compiler-only change leaves the save-time validator rejecting the field
    while the resolver happily selects it, or the reverse. The seam is named here so a future
    promotion checks the same three places.
    """
    src = _code(_RESOLVER)
    assert '"thread_key"' in src, (
        "document_view_resolver does not admit thread_key — validate_fields will reject a "
        "filter the compiler is perfectly happy to build"
    )


def test_a_reserved_or_unknown_field_is_still_refused():
    """The negative control. Without it, "the whitelist admits thread_key" could mean "the
    whitelist admits everything"."""
    for bad in ("_confidence", "definitely_not_a_field"):
        flt = ViewFilter(
            op="and", conditions=[ViewCondition(field=bad, op="eq", value="x")]
        )
        with pytest.raises(ValueError):
            validate_fields(flt, {"thread_key", "title"})


def test_the_index_leads_with_user_id():
    """⛔ TM-240-06 — a thread_key is chosen by whoever SENT the mail.

    Two unrelated users can be made to share one, so `thread_key` is never a lookup handle on its
    own. The migration's index leads with `user_id`, which makes the scoped read the fast path
    and an unscoped read visibly wrong rather than merely slow.
    """
    migration = (
        _BACKEND.parent / "supabase" / "migrations" / "175_documents_thread_key.sql"
    ).read_text(encoding="utf-8")
    assert re.search(r"\(user_id,\s*thread_key\)", migration), (
        "documents_thread_key_idx must lead with user_id"
    )
    assert "WHERE thread_key IS NOT NULL" in migration, (
        "the index must be partial — most documents are not mail"
    )
